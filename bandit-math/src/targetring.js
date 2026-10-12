// THE TARGET RING: a glowing green loop that floats round the steer or bandit the lasso would go to, so aiming is easy.
// Every target gets exactly the same ring: it shows what the lasso is pointed at, never whether that is a right pick.
//
// Which one gets it:
//   1. with a mouse, the one whose body is under the pointer (the nearest, where bodies overlap: the one the eye sees
//      there), or the target's number card under the pointer;
//   2. with the pointer on none, the target whose ring is nearest the pointer on the screen, within about an eighth of
//      the screen's height (plus the target's own size on the screen): a near miss still counts;
//   3. if the pointer is near none (or there is no pointer: a touch screen, the mouse off the page), the one nearest the
//      middle of the screen that is ahead of the player and within 35 m (a "soft lock");
//   4. never one behind the camera, hidden behind a building or a hill, or already caught.
// A little stickiness keeps it from jumping between two close targets when the pointer is between them: another one
// takes the ring only when it is clearly nearer the pointer (a body right under the pointer takes it at once). When the
// ring moves to another target it slides over in about a tenth of a second. Out of the lasso's reach (15 m) the ring is
// pale and thinner (a click still throws: the player walks up first). The ringed target's number card (a record's
// .label) is drawn on top of the other cards with a green frame, so it is plain which number the ring means.
//
//   const R = makeTargetRing({ scene, camera, canvas, W })
//     scene: where the ring is added (W.scene); camera: the game's camera; canvas: the 3D view (its mouse pointer is
//     followed here); W (optional): the world, so targets behind the town's buildings or a hill are left out
//   R.update(dt, { targets, player, pointer, reach, can, hold, busy })   each frame, after the player and the targets have
//     moved (and their number cards been placed) and before the frame is drawn
//       targets  the things that can be roped: an animal (makeAnimal), a person (makePerson), or the game's own record
//                for one with the animal or person in .a / .animal / .person / .body (or a .root). A record may carry
//                .ring = { y, z, radius } (metres, in its own space) to place its ring by hand, and .label: its number
//                card (a THREE.Sprite in the scene: pointing at it counts as pointing at the target, and while ringed it
//                is drawn on top with a frame; or a page element, which gets the class 'ringed' while ringed)
//       player   the player (P: its .position is read) or a Vector3: the reach and the soft lock are measured from it
//       pointer  { x, y } in page pixels, or null for none; left out, the mouse over the canvas is followed here
//       reach    the lasso's reach in metres (default 15, as player.js MOVE.reach)
//       can(t)   false for a target that can't be roped now (default: not one marked .caught, .busy or .gone)
//       hold     true: keep the ring on the target it is on and don't pick again (a throw asked for, the player walking
//                up to it): pass P.lassoBusy
//       busy     true: the ring fades away and stays put (the rope is out): pass P.lasso.busy
//   R.target     the ringed target (one of `targets`, as given) or null: F, Space and a touch Rope button throw at this one
//   R.click(x, y) a mouse click at a page point: the target to throw at, picked at the click's own spot (the body or card
//                under it, else the nearest within the catch zone), or the soft-locked one if the click is fairly near it;
//                null for a click far from every target (so a stray click, or a click to bring the window to the front,
//                doesn't throw and record an answer). The ring moves to what it returns
//   R.pick(x, y) a tap on a touch screen (page pixels): the target under it or nearest it (a big catch zone) is ringed and
//                returned (null if none is near); it keeps the ring for a moment, so the throw can start on it
//   R.inReach    true when R.target is within the lasso's reach (measured from where it stands, as the player measures)
//   R.dist       metres from the player to R.target
//   R.how        how it was picked: 'pointer' | 'soft' | 'tap' | 'none';  R.hit (by the pointer or a tap): 'body' (its body
//                or number card is under it) | 'near' (a near miss, in the catch zone) | null
//   R.screen     where the ringed target's ring is on the page: { x, y, r } (pixels), for a test or a hint
//   R.screenOf(t) where any target's ring would be on the page: { x, y, r, on }
//   R.visible    false hides the ring (a panel open over the game); picking still goes on
//   R.dispose()  takes it out of the scene and lets go of its shapes and listeners (update and pick then do nothing)
//   pickTarget(cands, opts)  the pick on its own, in plain numbers (tested in tests/targetring.test.mjs)
//   rayHit(o, d, pos, idx, cull, maxT)  how far along a ray it first meets a shape's triangles (tested there too)
//   RING         the sizes, timings and colours
import * as THREE from 'three';

export const RING = {
  zone: 0.12,          // the pointer's catch zone: this share of the screen's height round the pointer, plus the target's own size
  keep: 1.3,           // ... the ringed target's zone is this much bigger (so the ring doesn't drop off at the zone's edge)
  tapZone: 0.2,        // a tap's catch zone (fingers are bigger than a pointer)
  stick: 0.04,         // another target must be this share of the screen's height nearer to take the ring from the ringed one
  sizeBonus: 0.6,      // how much a big (near) target's own size on screen counts toward being nearer the pointer
  softRange: 35,       // the soft lock looks this far ahead of the player (m)
  softFar: 0.004,      // ... and prefers nearer targets a little: each metre away counts as this share of the screen's height
  maxRange: 70,        // the farthest the pointer can ring (m)
  reach: 15,           // the lasso's reach (m), when the game doesn't say (player.js MOVE.reach)
  clickNear: 2,        // a click near no target still throws at the soft-locked one when it is within this many times its
                       // catch zone of it; farther off, a click throws at nothing (F, Space and the Rope button still do)
  clickAnywhere: false,   // true: any click throws at the ringed one, however far from it
  pin: 1.5,            // seconds a tapped target keeps the ring
  slide: 0.12,         // seconds the ring takes to move over to another target
  fade: 0.15,          // seconds to fade in or out
  pop: 0.35,           // a ring that appears from nothing starts this much bigger and settles in
  tilt: 0.42,          // radians the ring leans toward the camera (so it reads as a loop, not a flat line)
  turn: 0.5,           // radians a second it turns
  pulse: 1.4,          // seconds a pulse (it swells a little and glows a little brighter)
  swell: 0.035,        // ... by this share of its size
  tube: [0.045, 0.003, 0.13],   // the loop's thickness (its radius, m): the first, or the second times the metres from the
                                // camera if that is more (so a far ring is still a few pixels thick), but never past the last
  minPx: 2.6,          // ... and never thinner on the screen than this many of the screen's own pixels across
  paleTube: 0.72,      // out of reach the loop is this much thinner ...
  paleFar: [30, 45],   // ... but less so from the first of these distances from the camera (m), and not at all past the second
  green: '#29ff3a',    // the ring
  core: '#b9ffa8',     // the bright middle of the loop facing the camera
  edge: '#06501a',     // its edges (a dark rim, so it reads against bright sky and pale grass)
  pale: '#c9f2c0',     // out of reach
  glow: 0.32,          // the soft glow round the loop (added light: it brightens what is behind it)
  glowWide: 3.2,       // ... this many times the loop's thickness
  ghost: 0.3,          // how strongly the ring shows through whatever is in front of it (the animal's own body, grass)
  ground: 0.5,         // how strongly the circle on the ground under it shows
  cardPad: 0.13,       // the frame round the ringed target's number card: this share of the card's height outside it
  cardMargin: 0.08,    // pointing at a card counts this share of its height in from its edges (its see-through margin)
  firstLook: 2,        // milliseconds a frame may spend reading targets' shapes the first time (a click doesn't wait)
  bodyEvery: 0.1,      // seconds the body under a pointer that rests (and a camera that stays put) is kept before it is looked at again
};

// how far each kind of thing is roped round, in its own space: the middle of the loop (y up, z forward) and its size
// (an animal or a person is used as it is; a game's record for one is looked into. A person from makePerson has its own
// .person and .body fields, which are not what is meant here: so the target itself is tried first)
const isBody = (o) => !!o && typeof o === 'object' && (o.isObject3D || (o.root && (o.info || o.bones)));
function specOf(t) {
  const body = isBody(t) ? t : [t.a, t.animal, t.person, t.body].find(isBody) || t;
  const root = body.isObject3D ? body : body.root || t.root || null;
  if (!root) return null;
  const s = { root, x: 0, y: 1, z: 0, radius: 0.5, meshes: null, box: null };
  const info = body.info;
  if (info && info.lasso) {
    // an animal: round the shoulders and neck, the loop's middle between the body's middle and the neck
    const len = info.length || 2, h = info.height || 1.2;
    s.y = h * 0.72; s.z = (info.lasso.at ? info.lasso.at[2] : len * 0.38) * 0.42;
    s.radius = Math.max(0.35, Math.min(1.25, len * 0.36));
  } else if (body.bones && (body.bones.Neck || body.bones.Head)) {
    // a person: round the chest, sized from where the neck is (a child's ring is smaller)
    const nb = body.bones.Neck || body.bones.Head, w = new THREE.Vector3(), r = new THREE.Vector3();
    root.updateWorldMatrix(true, true); nb.getWorldPosition(w); root.getWorldPosition(r);
    const sc = new THREE.Vector3().setFromMatrixScale(root.matrixWorld).y || 1;
    const neck = Math.max(0.6, Math.min(2.2, (w.y - r.y) / sc || 1.5));
    s.y = neck * 0.87; s.radius = 0.5 * Math.max(0.6, neck / 1.5);
  } else {
    const h = body.height || t.height || 1.2;
    s.y = h * 0.7; s.radius = Math.max(0.4, h * 0.35);
  }
  const o = t.ring;
  if (o) { if (o.y != null) s.y = o.y; if (o.z != null) s.z = o.z; if (o.radius != null) s.radius = o.radius; }
  return s;
}

const defaultCan = (t) => !(t.caught || t.busy || t.gone);

// THE PICK, in plain numbers. cands: one per target, { x, y, r, ok, dist, ahead }: x, y where its ring's middle is on
// the screen (pixels from the canvas's top left), r the ring's size there (pixels), ok false when it can't be picked
// (behind the camera, hidden, caught), dist metres from the player, ahead true when it is in front of the player.
// opts: { pointer: { x, y } (canvas pixels) or null, width, height (the canvas, pixels), current (the index ringed now,
// -1 for none), under (the index of the target whose body or card is right under the pointer, -1 for none: it wins
// outright), soft (false: no soft lock, as for a tap), and RING's zone, keep, stick, sizeBonus, softRange, softFar,
// maxRange to change }. Returns { index (-1 for none), how: 'pointer' | 'soft' | 'none', hit: 'body' | 'near' | null }.
export function pickTarget(cands, opts = {}) {
  const { pointer = null, width = 1, height = 1, current = -1, under = -1, soft = true, zone = RING.zone, keep = RING.keep,
    stick = RING.stick, sizeBonus = RING.sizeBonus, softRange = RING.softRange, softFar = RING.softFar, maxRange = RING.maxRange } = opts;
  const H = height, margin = stick * H;
  const onScreen = (c, pad) => c.x >= -pad && c.x <= width + pad && c.y >= -pad && c.y <= height + pad;
  // the best by a score (lower is better), keeping the ringed one unless another is clearly better
  const choose = (score) => {
    let best = -1, bestS = Infinity, curS = Infinity;
    for (let i = 0; i < cands.length; i++) {
      const s = score(cands[i], i); if (s === null) continue;
      if (i === current) curS = s;
      if (s < bestS) { bestS = s; best = i; }
    }
    if (best >= 0 && best !== current && curS < Infinity && bestS > curS - margin) best = current;
    return best;
  };
  const usable = (c) => c && c.ok !== false && Number.isFinite(c.x) && Number.isFinite(c.y);
  if (pointer) {
    // the body under the pointer: no catch zone and no stickiness, it is what the eye sees there
    if (under >= 0 && usable(cands[under]) && cands[under].dist <= maxRange) return { index: under, how: 'pointer', hit: 'body' };
    const zonePx = zone * H;
    const i = choose((c, idx) => {
      if (!usable(c) || !(c.dist <= maxRange)) return null;
      const r = Math.max(0, c.r || 0);
      if (!onScreen(c, r * 0.5)) return null;
      const d = Math.hypot(c.x - pointer.x, c.y - pointer.y);
      if (d > (zonePx + r) * (idx === current ? keep : 1)) return null;
      return d - sizeBonus * Math.min(r, zonePx);
    });
    if (i >= 0) return { index: i, how: 'pointer', hit: 'near' };
  }
  if (soft) {
    const cx = width / 2, cy = height / 2;
    const i = choose((c) => {
      if (!usable(c) || !(c.dist <= softRange) || c.ahead === false || !onScreen(c, 0)) return null;
      return Math.hypot(c.x - cx, c.y - cy) + softFar * c.dist * H;
    });
    if (i >= 0) return { index: i, how: 'soft', hit: null };
  }
  return { index: -1, how: 'none', hit: null };
}

// HOW FAR ALONG A RAY IT FIRST MEETS A SHAPE: o the ray's start and d its way ([x, y, z] each; d need not be one unit
// long: the answer is in lengths of d), pos the shape's corners (x, y, z after each other), idx the corners of each
// triangle in threes (null: the corners in order), cull 1 to skip triangles facing away from the ray's start (the far
// side of a solid body, as three.js draws it), -1 to skip those facing it, 0 for neither. Returns the nearest distance
// under maxT, or Infinity. (The same test as three.js's Ray.intersectTriangle, on plain numbers so it is quick.)
export function rayHit(o, d, pos, idx, cull = 1, maxT = Infinity) {
  const ox = o[0], oy = o[1], oz = o[2], dx = d[0], dy = d[1], dz = d[2];
  const n = idx ? idx.length : Math.floor(pos.length / 9) * 3;
  let best = maxT;
  for (let k = 0; k + 2 < n; k += 3) {
    const a = (idx ? idx[k] : k) * 3, b = (idx ? idx[k + 1] : k + 1) * 3, c = (idx ? idx[k + 2] : k + 2) * 3;
    const ax = pos[a], ay = pos[a + 1], az = pos[a + 2];
    const e1x = pos[b] - ax, e1y = pos[b + 1] - ay, e1z = pos[b + 2] - az, e2x = pos[c] - ax, e2y = pos[c + 1] - ay, e2z = pos[c + 2] - az;
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    let dn = dx * nx + dy * ny + dz * nz, sign;
    if (dn > 0) { if (cull > 0) continue; sign = 1; } else if (dn < 0) { if (cull < 0) continue; sign = -1; dn = -dn; } else continue;
    const qx = ox - ax, qy = oy - ay, qz = oz - az;
    // (inside the triangle: both edge tests and their sum)
    const u = sign * (dx * (qy * e2z - qz * e2y) + dy * (qz * e2x - qx * e2z) + dz * (qx * e2y - qy * e2x)); if (u < 0) continue;
    const v = sign * (dx * (e1y * qz - e1z * qy) + dy * (e1z * qx - e1x * qz) + dz * (e1x * qy - e1y * qx)); if (v < 0 || u + v > dn) continue;
    const t = -sign * (qx * nx + qy * ny + qz * nz) / dn;
    if (t > 0 && t < best) best = t;
  }
  return best < maxT ? best : Infinity;
}

// ── THE LOOK ───────────────────────────────────────────────────────────────────────────────────────────────────────
// The loop is drawn by the graphics card from two angles a corner (round the ring, round the tube), so its size and
// thickness are two numbers set each frame: no shape is made again. It is drawn three times from the one shape: once
// properly (hidden by what is in front of it, pulled a hair toward the camera so grass and fur right at it don't cut
// it), once faintly through everything (so the part behind the animal's body still shows as a loop), and once fatter
// as a soft glow of added light round it.
const RING_VS = /* glsl */`
  uniform float uR, uTube, uGlowWide;
  varying vec3 vN, vV;
  varying vec2 vA;
  void main() {
    float u = position.x, v = position.y;
    vec3 dir = vec3(cos(u), 0.0, sin(u));
    vec3 n = dir * cos(v) + vec3(0.0, sin(v), 0.0);
  #ifdef HALO
    float tube = uTube * uGlowWide;
  #else
    float tube = uTube;
  #endif
    vec4 mv = modelViewMatrix * vec4(dir * uR + n * tube, 1.0);
    vN = normalize(normalMatrix * n); vV = -mv.xyz; vA = vec2(u, v);
    gl_Position = projectionMatrix * mv;
  }`;
const RING_FS = /* glsl */`
  uniform vec3 uGreen, uCore, uEdge, uPaleC;
  uniform float uAlpha, uSpin, uGlow, uPale, uGhost, uHalo;
  varying vec3 vN, vV;
  varying vec2 vA;
  void main() {
    float f = abs(dot(normalize(vN), normalize(vV)));          // 1: this bit of the tube faces the camera; 0: its edge
    float u = vA.x - uSpin;
    float lay = 0.5 + 0.5 * sin(u * 34.0 + vA.y);              // a rope's twist along it (it shows the ring turning)
    float arcs = pow(0.5 + 0.5 * cos(u * 3.0), 6.0);           // three brighter stretches that go round
    vec3 c = mix(uEdge, uGreen, smoothstep(0.08, 0.62, f));
    c *= 0.8 + 0.2 * lay;
    c = mix(c, uCore, clamp((pow(f, 4.0) * 0.55 + arcs * 0.3) * uGlow, 0.0, 1.0));
    c = mix(c, uPaleC, uPale * 0.85 * smoothstep(0.1, 0.55, f));   // (pale, but its dark rim kept as an outline)
    float a = uAlpha * mix(1.0, 0.85, uPale);
  #ifdef GHOST
    c = mix(uGreen, uPaleC, uPale * 0.8); a *= uGhost * smoothstep(0.0, 0.5, f);
  #endif
  #ifdef HALO
    c = mix(uGreen, uPaleC, uPale * 0.8) * a * uHalo * (0.75 + 0.25 * uGlow) * pow(f, 2.2) * (1.0 - uPale * 0.6); a = 1.0;
  #endif
    gl_FragColor = vec4(c, a);
    #include <colorspace_fragment>
  }`;
// the faint circle on the ground under the ring (where the target stands: it helps judge how far off it is)
const GROUND_VS = /* glsl */`
  varying float vR;
  void main() { vR = length(position.xy); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const GROUND_FS = /* glsl */`
  uniform vec3 uGreen, uPaleC;
  uniform float uAlpha, uPale, uGround;
  varying float vR;
  void main() {
    float band = exp(-pow((vR - 1.0) / 0.07, 2.0));            // a soft line round at the ring's own size
    float fill = 1.0 - smoothstep(0.35, 1.0, vR);              // and a faint glow inside it
    vec3 c = mix(uGreen, uPaleC, uPale * 0.8);
    gl_FragColor = vec4(c, uAlpha * uGround * (band * 0.85 + fill * 0.12) * mix(1.0, 0.6, uPale));
    #include <colorspace_fragment>
  }`;

// the green frame round the ringed target's number card: a rounded outline (dark outside, bright inside), see-through in
// the middle; one picture for each shape of card (wide or tall)
const frames = new Map();
function frameTexture(aspect) {
  const key = Math.round(aspect * 20) / 20;
  let tex = frames.get(key);
  if (tex) return tex;
  const h = 128, w = Math.max(32, Math.round(h * key)), cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'), lw = 10, r = 26;
  const path = (inset) => { c.beginPath(); c.roundRect(inset, inset, w - inset * 2, h - inset * 2, Math.max(4, r - inset)); };
  c.strokeStyle = RING.edge; c.lineWidth = lw + 6; path(lw / 2 + 4); c.stroke();
  c.strokeStyle = RING.green; c.lineWidth = lw; path(lw / 2 + 4); c.stroke();
  tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  frames.set(key, tex);
  return tex;
}

export function makeTargetRing({ scene, camera, canvas, W = null }) {
  const SEG = 128, SIDES = 10;
  // the loop's corners: (angle round the ring, angle round the tube), its shape worked out on the graphics card
  const pos = new Float32Array((SEG + 1) * (SIDES + 1) * 3), idx = [];
  for (let i = 0; i <= SEG; i++) for (let j = 0; j <= SIDES; j++) {
    const k = (i * (SIDES + 1) + j) * 3; pos[k] = (i / SEG) * Math.PI * 2; pos[k + 1] = (j / SIDES) * Math.PI * 2;
  }
  for (let i = 0; i < SEG; i++) for (let j = 0; j < SIDES; j++) {
    const a = i * (SIDES + 1) + j, b = a + SIDES + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);              // (wound so the outside of the tube faces out)
  }
  const loopGeo = new THREE.BufferGeometry();
  loopGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); loopGeo.setIndex(idx);
  const U = {   // shared by both draws of the loop and the ground circle (one set of numbers, set once a frame)
    uR: { value: 1 }, uTube: { value: 0.05 }, uAlpha: { value: 0 }, uSpin: { value: 0 }, uGlow: { value: 1 }, uPale: { value: 0 },
    uGhost: { value: RING.ghost }, uGround: { value: RING.ground }, uHalo: { value: RING.glow }, uGlowWide: { value: RING.glowWide },
    uGreen: { value: new THREE.Color(RING.green) }, uCore: { value: new THREE.Color(RING.core) },
    uEdge: { value: new THREE.Color(RING.edge) }, uPaleC: { value: new THREE.Color(RING.pale) },
  };
  const loopMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: RING_VS, fragmentShader: RING_FS, transparent: true,
    depthWrite: false, depthTest: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });
  const ghostMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: RING_VS, fragmentShader: RING_FS, transparent: true,
    depthWrite: false, depthTest: false, defines: { GHOST: 1 } });
  // (the glow is light added on top: its colour is already scaled by how strong it is)
  const haloMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: RING_VS, fragmentShader: RING_FS, transparent: true,
    depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, defines: { HALO: 1 } });
  const groundMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: GROUND_VS, fragmentShader: GROUND_FS, transparent: true,
    depthWrite: false, depthTest: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });
  const groundGeo = new THREE.CircleGeometry(1.2, 64);
  const loop = new THREE.Mesh(loopGeo, loopMat), ghost = new THREE.Mesh(loopGeo, ghostMat), halo = new THREE.Mesh(loopGeo, haloMat);
  const ground = new THREE.Mesh(groundGeo, groundMat);
  // the ringed target's number card drawn again on top of the other cards (its own material, borrowed), and its frame
  const spareMat = new THREE.SpriteMaterial({ visible: false });
  const cardTop = new THREE.Sprite(spareMat);
  const frameMat = new THREE.SpriteMaterial({ map: frameTexture(4 / 3), transparent: true, depthWrite: false, toneMapped: false, fog: false });
  const frame = new THREE.Sprite(frameMat);
  const group = new THREE.Group(); group.name = 'targetRing';
  const tilted = new THREE.Group(); tilted.add(ghost, halo, loop); group.add(tilted, ground, cardTop, frame);
  for (const [m, order] of [[ground, 996], [ghost, 997], [halo, 998], [loop, 999], [cardTop, 1001], [frame, 1002]]) { m.frustumCulled = false; m.renderOrder = order; m.castShadow = m.receiveShadow = false; }
  cardTop.visible = frame.visible = false;
  group.visible = false;
  scene.add(group);

  const R = { target: null, inReach: false, how: 'none', hit: null, visible: true, screen: { x: 0, y: 0, r: 0 }, dist: Infinity, group };

  // ── THE POINTER: the mouse over the canvas (a touch screen has none: taps go through R.pick) ──────────────────────
  let mouse = null, rect = canvas.getBoundingClientRect(), rectAt = 0;
  const isMouse = (e) => e.pointerType === 'mouse' || e.pointerType === 'pen';
  const onMove = (e) => { if (isMouse(e)) mouse = { x: e.clientX, y: e.clientY }; };
  const onLeave = (e) => { if (isMouse(e)) mouse = null; };
  // a press: the pick is made again right there and then, so a click that lands before the next frame (a quick hand, a
  // slow computer) is on what is under it now, not on what the pointer was near a frame ago
  const onDown = (e) => {
    if (!isMouse(e)) return;
    mouse = { x: e.clientX, y: e.clientY };
    if (disposed || lastHold || lastBusy || (e.button !== undefined && e.button !== 0)) return;
    const res = pickAt(e.clientX, e.clientY, {});
    if (res.index >= 0) ringOn(res.index, 'pointer', res.hit);
  };
  const onResize = () => { rectAt = 0; };
  canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerleave', onLeave); addEventListener('resize', onResize);

  // ── HIDDEN? A line from the camera to the top of the target, tested against the ground and the town's buildings ──
  const B = (W && W.places && W.places.buildings) ? W.places.buildings.filter((b) => b && b.w)
    .map((b) => ({ x: b.x, z: b.z, c: Math.cos(b.rot), s: Math.sin(b.rot), hw: b.w / 2, hd: b.d / 2, top: W.heightAt(b.x, b.z) + (b.h || 8) })) : [];
  function hiddenFrom(e, p) {
    if (!W || !W.heightAt) return false;
    const dx = p.x - e.x, dy = p.y - e.y, dz = p.z - e.z, n = Math.min(24, Math.max(4, Math.ceil(Math.hypot(dx, dz) / 2)));
    for (let i = 1; i < n; i++) {
      const f = i / n, x = e.x + dx * f, y = e.y + dy * f, z = e.z + dz * f;
      if (f < 0.94 && W.heightAt(x, z) > y + 0.25) return true;                                  // a hill in the way
      for (const b of B) { const bx = x - b.x, bz = z - b.z; if (y < b.top && Math.abs(b.c * bx - b.s * bz) < b.hw && Math.abs(b.s * bx + b.c * bz) < b.hd) return true; }
    }
    return false;
  }
  const hidden = new WeakMap();       // target -> hidden? (a few targets are looked at again each frame, in turn)
  let hiddenTurn = 0, disposed = false;
  let lastTargets = [], lastReach = RING.reach, lastHold = false, lastBusy = false;   // (as last measured: a click between frames uses them)

  // ── WHAT IS UNDER THE POINTER: a line from the camera through the pointer, tested against each target's real shape
  // as it stands this frame (its legs, its lowered head). First against a box round each one (quick), then, nearest
  // first, against the triangles of the ones it passes through. The shapes are bent to the pose here (the graphics card
  // does that for drawing, out of reach of this code): each corner moved by its bones, once a frame at most per target.
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), lray = new THREE.Ray(), inv = new THREE.Matrix4();
  const hitAt = new THREE.Vector3(), tmpM = new THREE.Matrix4(), bindInv = new THREE.Matrix4(), tmpBox = new THREE.Box3();
  const shapes = new WeakMap();       // geometry -> its corners as plain numbers (and their bones and weights)
  const posed = new WeakMap();        // mesh -> { at: frame, pos: its corners in the pose of that frame }
  let frameNo = 0, boneEl = new Float64Array(64 * 16);
  const ro = [0, 0, 0], rd = [0, 0, 0];
  // an attribute's numbers as plain ones, `size` to an item (packed whole numbers turned back into fractions, as
  // three.js does; numbers stored side by side with others picked out)
  function plain(A, size, Out) {
    const n = A.count, inter = !!A.isInterleavedBufferAttribute, arr = inter ? A.data.array : A.array;
    const stride = inter ? A.data.stride : A.itemSize, at0 = inter ? A.offset : 0, out = new Out(n * size);
    const k = !A.normalized ? 1 : arr instanceof Int8Array ? 127 : arr instanceof Uint8Array ? 255 : arr instanceof Int16Array ? 32767
      : arr instanceof Uint16Array ? 65535 : arr instanceof Int32Array ? 2147483647 : arr instanceof Uint32Array ? 4294967295 : 1;
    const m = Math.min(size, A.itemSize);
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const x = arr[i * stride + at0 + j] / k; out[i * size + j] = x < -1 && k > 1 ? -1 : x; }
    return out;
  }
  function shapeOf(g) {
    let d = shapes.get(g); if (d) return d;
    const P = g.attributes.position, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
    const n = P.count, pos = plain(P, 3, Float32Array);
    const bi = SI && SW ? plain(SI, 4, Uint16Array) : null, bw = SI && SW ? plain(SW, 4, Float32Array) : null;
    const index = g.index ? g.index.array.subarray(0, g.index.count) : null;
    d = { n, pos, bi, bw, index }; shapes.set(g, d); return d;
  }
  // a mesh's corners in its own space, bent to this frame's pose (a mesh without bones: as made)
  function posedOf(mesh) {
    const d = shapeOf(mesh.geometry);
    if (!mesh.isSkinnedMesh || !d.bi || !mesh.skeleton) return d.pos;
    let p = posed.get(mesh);
    if (!p) { p = { at: -1, pos: new Float32Array(d.n * 3) }; posed.set(mesh, p); }
    if (p.at === frameNo) return p.pos;
    p.at = frameNo;
    // each bone's whole move, from the shape as made to its place now, in the mesh's own space (as three.js's skinning:
    // bindMatrixInverse x bone x boneInverse x bindMatrix)
    const sk = mesh.skeleton, bones = sk.bones, nb = bones.length;
    if (boneEl.length < nb * 16) boneEl = new Float64Array(nb * 16);
    if (mesh.bindMode === 'detached') bindInv.copy(mesh.bindMatrix).invert(); else bindInv.copy(mesh.matrixWorld).invert();
    for (let b = 0; b < nb; b++) {
      tmpM.multiplyMatrices(bones[b].matrixWorld, sk.boneInverses[b]).premultiply(bindInv).multiply(mesh.bindMatrix);
      const e = tmpM.elements; for (let k = 0; k < 16; k++) boneEl[b * 16 + k] = e[k];
    }
    const src = d.pos, bi = d.bi, bw = d.bw, out = p.pos, E = boneEl;
    for (let i = 0; i < d.n; i++) {
      const x = src[i * 3], y = src[i * 3 + 1], z = src[i * 3 + 2]; let ox = 0, oy = 0, oz = 0;
      for (let k = 0; k < 4; k++) {
        const w = bw[i * 4 + k]; if (w === 0) continue;
        const e = bi[i * 4 + k] * 16;
        ox += w * (E[e] * x + E[e + 4] * y + E[e + 8] * z + E[e + 12]);
        oy += w * (E[e + 1] * x + E[e + 5] * y + E[e + 9] * z + E[e + 13]);
        oz += w * (E[e + 2] * x + E[e + 6] * y + E[e + 10] * z + E[e + 14]);
      }
      out[i * 3] = ox; out[i * 3 + 1] = oy; out[i * 3 + 2] = oz;
    }
    return out;
  }
  // a target's meshes and a box round them in its own space, made the first time it is needed from the corners as they
  // stand then (a bent shape's corners as stored mean nothing until its bones place them); roomy, as the pose moves the
  // legs and head about afterwards
  function bodyOf(s) {
    if (s.meshes) return s;
    s.meshes = []; s.box = new THREE.Box3();
    s.root.updateWorldMatrix(true, true);
    const toRoot = new THREE.Matrix4().copy(s.root.matrixWorld).invert();
    s.root.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      s.meshes.push(o);
      const pos = posedOf(o); tmpBox.makeEmpty();
      for (let i = 0; i + 2 < pos.length; i += 3) tmpBox.expandByPoint(hitAt.set(pos[i], pos[i + 1], pos[i + 2]));
      if (!tmpBox.isEmpty()) s.box.union(tmpBox.applyMatrix4(tmpM.multiplyMatrices(toRoot, o.matrixWorld)));
    });
    if (!s.box.isEmpty()) {
      const z = s.box.getSize(hitAt);
      s.box.expandByVector(hitAt.set(z.x * 0.2 + 0.1, z.y * 0.12 + 0.1, z.z * 0.2 + 0.1));
    }
    return s;
  }
  const shown = (o, root) => { for (let q = o; q; q = q.parent) { if (q.visible === false) return false; if (q === root) return true; } return true; };
  // how far along the pointer's line (from the camera, metres) it meets this target's body, or Infinity
  function rayBody(s, best) {
    for (const m of s.meshes) {
      if (!shown(m, s.root)) continue;
      const mat = Array.isArray(m.material) ? m.material[0] : m.material;
      if (!mat || mat.visible === false) continue;
      const pos = posedOf(m), d = shapeOf(m.geometry);
      // the line in the mesh's own space (its way not made one unit long, so distances along it stay in metres)
      const e = inv.copy(m.matrixWorld).invert().elements, O = ray.ray.origin, D = ray.ray.direction;
      ro[0] = e[0] * O.x + e[4] * O.y + e[8] * O.z + e[12]; ro[1] = e[1] * O.x + e[5] * O.y + e[9] * O.z + e[13]; ro[2] = e[2] * O.x + e[6] * O.y + e[10] * O.z + e[14];
      rd[0] = e[0] * D.x + e[4] * D.y + e[8] * D.z; rd[1] = e[1] * D.x + e[5] * D.y + e[9] * D.z; rd[2] = e[2] * D.x + e[6] * D.y + e[10] * D.z;
      const t = rayHit(ro, rd, pos, d.index, mat.side === THREE.DoubleSide ? 0 : mat.side === THREE.BackSide ? -1 : 1, best);
      if (t < best) best = t;
    }
    return best;
  }
  // the number card of a target (a sprite in the scene), if it has one showing
  const cardOf = (t) => { const l = t && t.label; return l && l.isSprite && l.parent && l.visible !== false ? l : null; };
  const cardAt = new THREE.Vector3(), cardScale = new THREE.Vector3();
  // how far along the pointer's line it meets a target's number card (a sprite: a flat card facing the camera)
  function rayCard(l, nx, ny) {
    l.updateWorldMatrix(true, false);
    cardAt.setFromMatrixPosition(l.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
    const depth = -cardAt.z; if (depth <= camera.near) return Infinity;
    cardScale.setFromMatrixScale(l.matrixWorld);
    const p = camera.projectionMatrix.elements, px = nx * depth / p[0], py = ny * depth / p[5];
    // (less a little all round: a card picture usually has a see-through margin and rounded corners)
    const m = RING.cardMargin * cardScale.y, x0 = cardAt.x - l.center.x * cardScale.x + m, y0 = cardAt.y - l.center.y * cardScale.y + m;
    if (px < x0 || px > x0 + cardScale.x - 2 * m || py < y0 || py > y0 + cardScale.y - 2 * m) return Infinity;
    return depth * Math.hypot(nx / p[0], ny / p[5], 1);
  }
  // the target whose body (or card) is right under a canvas point: its index in the targets last measured, or -1
  // (the ringed one's card is drawn on top of the others, so where it covers another card it is the one seen).
  // A target's shape is read the first time it is needed; in a frame that would read many (the pointer coming over a
  // whole herd at once) only RING.firstLook milliseconds' worth are read and the rest wait a frame or two, unless
  // `all` (a click: everything needed is read at once). bodyUnder.waited says some had to wait.
  function bodyUnder(lx, ly, current, all = false) {
    const t0 = performance.now(); let made = 0; bodyUnder.waited = false;
    const w = rect.width || 1, h = rect.height || 1;
    ndc.set(lx / w * 2 - 1, 1 - ly / h * 2);
    ray.setFromCamera(ndc, camera);
    const order = [];
    let best = Infinity, bestI = -1;
    const curCard = current >= 0 ? cardOf(lastTargets[current]) : null, curCardD = curCard ? rayCard(curCard, ndc.x, ndc.y) : Infinity;
    for (let i = 0; i < lastTargets.length; i++) {
      const c = cands[i]; if (!c || !c.ok || !(c.dist <= RING.maxRange)) continue;
      const t = lastTargets[i], s = spec(t); if (!s) continue;
      const l = cardOf(t);
      if (l) { const dc = i === current ? curCardD : (curCardD < Infinity ? Infinity : rayCard(l, ndc.x, ndc.y)); if (dc < best) { best = dc; bestI = i; } }
      if (!s.meshes) {
        if (!all && made > 0 && performance.now() - t0 > RING.firstLook) { bodyUnder.waited = true; continue; }
        bodyOf(s); made++;
      }
      if (s.box.isEmpty()) continue;
      inv.copy(s.root.matrixWorld).invert();
      lray.copy(ray.ray).applyMatrix4(inv);
      if (!lray.intersectBox(s.box, hitAt)) continue;
      hitAt.applyMatrix4(s.root.matrixWorld);
      order.push({ i, s, d: hitAt.distanceTo(ray.ray.origin) });
    }
    order.sort((a, b) => a.d - b.d);
    for (const o of order) {
      if (o.d >= best) break;
      o.s.root.updateWorldMatrix(true, true);
      const t = rayBody(o.s, best);
      if (t < best) { best = t; bestI = o.i; }
    }
    return bestI;
  }

  // ── EACH FRAME ───────────────────────────────────────────────────────────────────────────────────────────────────
  const specs = new WeakMap(), cands = [], centres = [];
  const v = new THREE.Vector3(), top = new THREE.Vector3(), camFwd = new THREE.Vector3(), toCam = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const at = new THREE.Vector3(), off = new THREE.Vector3(), nrm = new THREE.Vector3(), scl = new THREE.Vector3();
  let time = 0, alpha = 0, paleK = 0, offR = 0, drawnR = 0.5, followT = null, pinT = 0, cardEl = null;
  // the body under the pointer, kept a moment while neither the pointer nor the camera moves (a mouse resting on a cow
  // needn't have it tested again every frame): what it was, where, when, and where the camera was
  const seen = { t: null, x: NaN, y: NaN, at: -1, cur: -2, cam: new Float64Array(16) };
  function underNow(lx, ly, current) {
    const e = camera.matrixWorld.elements; let still = Math.abs(lx - seen.x) < 1 && Math.abs(ly - seen.y) < 1 && current === seen.cur && time - seen.at < RING.bodyEvery;
    for (let k = 0; still && k < 16; k++) if (Math.abs(e[k] - seen.cam[k]) > 1e-4) still = false;
    if (still) { const i = seen.t ? lastTargets.indexOf(seen.t) : -1; if (!seen.t || (i >= 0 && cands[i].ok)) return i; }
    const i = bodyUnder(lx, ly, current);
    seen.t = i >= 0 ? lastTargets[i] : null; seen.x = lx; seen.y = ly; seen.at = bodyUnder.waited ? -1 : time; seen.cur = current; seen.cam.set(e);
    return i;
  }
  const followAt = new THREE.Vector3();     // where the ring's target's middle is (kept when it goes, so the ring fades in place)

  function spec(t) { let s = specs.get(t); if (s === undefined) { s = specOf(t); specs.set(t, s); } return s; }
  // where a target's ring goes, in the world, this frame (into out); returns its size (m) or 0
  function centreOf(t, out) {
    const s = spec(t); if (!s) return 0;
    s.root.updateWorldMatrix(true, false);
    out.set(s.x, s.y, s.z).applyMatrix4(s.root.matrixWorld);
    return s.radius * (scl.setFromMatrixScale(s.root.matrixWorld).x || 1);
  }

  // every target's place on the screen, for the pick
  function measure(targets, can, pp, from, per) {
    const w = rect.width || 1, h = rect.height || 1, e = camera.position, proj = camera.projectionMatrix.elements;
    camera.getWorldDirection(camFwd); camFwd.y = 0; camFwd.normalize();
    cands.length = targets.length;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i], c = cands[i] || (cands[i] = { x: 0, y: 0, r: 0, ok: false, dist: Infinity, ahead: false, radius: 0 });
      const ctr = centres[i] || (centres[i] = new THREE.Vector3());
      c.ok = false; c.x = c.y = NaN;
      const s = t ? spec(t) : null;
      if (!s || !s.root.parent || s.root.visible === false || !can(t)) continue;
      const rad = c.radius = centreOf(t, ctr);
      v.copy(ctr).applyMatrix4(camera.matrixWorldInverse);
      if (v.z > -camera.near) continue;                                                           // behind the camera
      const d = -v.z;
      v.applyMatrix4(camera.projectionMatrix);
      c.x = (v.x + 1) / 2 * w; c.y = (1 - v.y) / 2 * h; c.r = rad * proj[5] / d * h / 2;
      // how far off it is: from where it stands (its feet), as the player measures it when it walks up to throw
      const m = s.root.matrixWorld.elements;
      c.dist = pp ? Math.hypot(m[12] - pp.x, m[14] - pp.z) : d;
      c.ahead = pp ? (ctr.x - pp.x) * camFwd.x + (ctr.z - pp.z) * camFwd.z > -1 : true;
      let hid = hidden.get(t);
      if (hid === undefined || (i - from + targets.length) % targets.length < per) { top.copy(ctr); top.y += rad * 0.5; hid = hiddenFrom(e, top); hidden.set(t, hid); }
      c.ok = !hid;
    }
  }

  // the pick at a page point, from the targets as last measured: the body or card under it first, then the catch zone
  function pickAt(x, y, opts) {
    rect = canvas.getBoundingClientRect(); rectAt = 1;
    const lx = x - rect.left, ly = y - rect.top;
    const cur = R.target ? lastTargets.indexOf(R.target) : -1, current = cur >= 0 && cands[cur] && cands[cur].ok ? cur : -1;
    const under = bodyUnder(lx, ly, current, true);
    return pickTarget(cands, { pointer: { x: lx, y: ly }, width: rect.width, height: rect.height, current, under, soft: false, ...opts });
  }
  // the ring moves to the target at index i (sliding over from where it is, or popping in)
  function ringOn(i, how, hit) {
    const t = lastTargets[i], c = cands[i];
    if (t !== R.target) {
      if (followT && alpha > 0.05) { centreOf(t, v); off.copy(at).sub(v); offR = drawnR - c.radius; }
      else { off.set(0, 0, 0); offR = c.radius * RING.pop; }
      R.target = t;
    }
    followT = t; R.how = how; R.hit = hit || null;
    R.dist = c.dist; R.inReach = c.dist <= lastReach;
    return t;
  }

  R.update = (dt, { targets = [], player = null, pointer, reach = RING.reach, can = defaultCan, hold = false, busy = false } = {}) => {
    if (disposed) return;
    dt = Math.min(Math.max(dt || 0, 0), 0.1); time += dt; frameNo++;
    if ((rectAt -= dt) <= 0) { rect = canvas.getBoundingClientRect(); rectAt = 1; }
    camera.updateMatrixWorld();
    const pp = player ? (player.position || player) : null;
    // a few targets' hidden-or-not looked at again this frame, in turn (it's a dozen height reads each)
    const n = targets.length, per = Math.min(n, 4), from = n ? hiddenTurn % n : 0;
    hiddenTurn = n ? (from + per) % n : 0;
    // (a copy of the list: the game may change its own between frames, and a click then must find what was measured)
    lastTargets.length = n; for (let i = 0; i < n; i++) lastTargets[i] = targets[i];
    lastReach = reach; lastHold = !!hold; lastBusy = !!busy;
    measure(targets, can, pp, from, per);

    // the pick
    const cur = R.target ? targets.indexOf(R.target) : -1;
    let next = cur, how = R.how, hit = R.hit;
    pinT = Math.max(0, pinT - dt);
    const curOk = cur >= 0 && cands[cur].ok;
    if ((pinT > 0 || hold || busy) && curOk) { /* kept: tapped, or a throw under way */ }
    else if (hold || busy) { if (cur < 0 || !curOk) { next = -1; how = 'none'; } }
    else {
      const ptr = pointer === undefined ? mouse : pointer;
      const lp = ptr ? { x: ptr.x - rect.left, y: ptr.y - rect.top } : null;
      const under = lp ? underNow(lp.x, lp.y, curOk ? cur : -1) : -1;
      const res = pickTarget(cands, { pointer: lp, width: rect.width, height: rect.height, current: curOk ? cur : -1, under });
      next = res.index; how = res.how; hit = res.hit;
    }
    const nextT = next >= 0 ? targets[next] : null;
    if (nextT) ringOn(next, how, hit);
    else { R.target = null; R.how = 'none'; R.hit = null; }
    // where it is drawn: on its target (or where the last one was, fading), plus what is left of the slide over
    let rad = drawnR;
    if (followT) { const r = centreOf(followT, followAt); if (r) rad = r; }
    const k = Math.exp(-dt * 3 / RING.slide);
    off.multiplyScalar(k); offR *= k;
    at.copy(followAt).add(off);
    const c = next >= 0 ? cands[next] : null;
    R.dist = c ? c.dist : Infinity;
    R.inReach = !!c && c.dist <= reach;
    if (c) { R.screen.x = c.x + rect.left; R.screen.y = c.y + rect.top; R.screen.r = c.r; }
    const show = !!nextT && R.visible && !busy;
    alpha = show ? Math.min(1, alpha + dt / RING.fade) : Math.max(0, alpha - dt / RING.fade);
    paleK += ((c && !R.inReach ? 1 : 0) - paleK) * (1 - Math.exp(-dt * 10));
    if (!show && alpha <= 0) followT = nextT;
    // a number card that is a page element: marked while its target is ringed (the page draws the mark)
    const el = nextT && nextT.label && nextT.label.classList && R.visible ? nextT.label : null;
    if (el !== cardEl) { if (cardEl) cardEl.classList.remove('ringed'); if (el) el.classList.add('ringed'); cardEl = el; }
    group.visible = alpha > 0.001 && R.visible;
    if (!group.visible) return;

    // the look: tilted toward the camera, turning, pulsing; thick enough to see from far off, thinner out of reach
    const pulse = Math.sin(time * Math.PI * 2 / RING.pulse);
    drawnR = Math.max(0.05, rad + offR);
    const camD = camera.position.distanceTo(at);
    U.uR.value = drawnR * (1 + RING.swell * pulse);
    // (a far pale ring isn't thinned as much, and no ring is drawn thinner than RING.minPx of the screen's own pixels:
    // canvas.height is the pixels it is drawn with, fewer than the page's on a slow computer)
    const farK = Math.min(1, Math.max(0, (camD - RING.paleFar[0]) / (RING.paleFar[1] - RING.paleFar[0])));
    const pxPerM = camera.projectionMatrix.elements[5] * (canvas.height || rect.height || 1) / (2 * Math.max(0.1, camD));
    U.uTube.value = Math.max(RING.minPx / 2 / pxPerM,
      Math.min(RING.tube[2], Math.max(RING.tube[0], camD * RING.tube[1])) * (1 - (1 - RING.paleTube) * paleK * (1 - farK)));
    U.uAlpha.value = alpha * alpha * (3 - 2 * alpha);
    U.uSpin.value = time * RING.turn;
    U.uGlow.value = 0.8 + 0.2 * pulse;
    U.uPale.value = paleK;
    tilted.position.copy(at);
    toCam.subVectors(camera.position, at); toCam.y = 0;
    if (toCam.lengthSq() < 1e-6) toCam.set(0, 0, 1);
    toCam.normalize();
    nrm.copy(up).multiplyScalar(Math.cos(RING.tilt)).addScaledVector(toCam, Math.sin(RING.tilt));
    tilted.quaternion.setFromUnitVectors(up, nrm);
    // the circle on the ground: under the ring, lying along the slope
    if (W && W.heightAt) {
      const gx = at.x, gz = at.z, e = 0.6, hx = W.heightAt(gx + e, gz) - W.heightAt(gx - e, gz), hz = W.heightAt(gx, gz + e) - W.heightAt(gx, gz - e);
      ground.position.set(gx, W.heightAt(gx, gz) + 0.05, gz);
      nrm.set(-hx / (2 * e), 1, -hz / (2 * e)).normalize();
      ground.quaternion.setFromUnitVectors(v.set(0, 0, 1), nrm);
      ground.scale.setScalar(drawnR);
      ground.visible = true;
    } else ground.visible = false;
    // the ringed target's number card: drawn again over the other cards, with the frame round it (the same for every
    // target: it says which number the ring means, never whether it is right)
    const card = cardOf(followT);
    cardTop.visible = frame.visible = !!card && U.uAlpha.value > 0.02;
    if (cardTop.visible) {
      card.updateWorldMatrix(true, false);
      card.matrixWorld.decompose(cardAt, cardTop.quaternion, cardScale);
      cardTop.material = card.material; cardTop.position.copy(cardAt); cardTop.scale.copy(cardScale); cardTop.center.copy(card.center);
      const p = RING.cardPad * cardScale.y, fw = cardScale.x + 2 * p, fh = cardScale.y + 2 * p;
      const tex = frameTexture(fw / fh); if (frameMat.map !== tex) { frameMat.map = tex; frameMat.needsUpdate = true; }
      frame.position.copy(cardAt); frame.scale.set(fw, fh, 1);
      frame.center.set((card.center.x * cardScale.x + p) / fw, (card.center.y * cardScale.y + p) / fh);
      frameMat.opacity = U.uAlpha.value * (1 - paleK * 0.35);
    }
  };

  // where a target's ring would be on the page: { x, y, r, on } (pixels; on: in front of the camera and on the screen)
  R.screenOf = (t) => {
    const r0 = canvas.getBoundingClientRect(), rad = t ? centreOf(t, v) : 0;
    if (!rad) return { x: NaN, y: NaN, r: 0, on: false };
    camera.updateMatrixWorld(); v.applyMatrix4(camera.matrixWorldInverse); const d = -v.z;
    if (d <= camera.near) return { x: NaN, y: NaN, r: 0, on: false };
    v.applyMatrix4(camera.projectionMatrix);
    return { x: r0.left + (v.x + 1) / 2 * r0.width, y: r0.top + (1 - v.y) / 2 * r0.height, r: rad * camera.projectionMatrix.elements[5] / d * r0.height / 2,
      on: Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 };
  };
  // a mouse click: the target to throw at (see the top of this file), or null
  R.click = (x, y) => {
    if (disposed || lastHold || lastBusy) return null;
    const res = pickAt(x, y, {});
    if (res.index >= 0 && lastTargets[res.index]) return ringOn(res.index, 'pointer', res.hit);
    const t = R.target; if (!t) return null;
    if (RING.clickAnywhere) return t;
    const i = lastTargets.indexOf(t), c = cands[i];
    if (!c || !c.ok) return null;
    const d = Math.hypot(c.x - (x - rect.left), c.y - (y - rect.top));
    return d <= RING.clickNear * (RING.zone * rect.height + c.r) ? t : null;
  };
  // a tap (touch): the target under it or nearest it, within a big catch zone, gets the ring for a moment
  R.pick = (x, y) => {
    if (disposed) return null;
    const res = pickAt(x, y, { zone: RING.tapZone, current: -1 });
    if (res.index < 0 || !lastTargets[res.index]) return null;
    const t = ringOn(res.index, 'tap', res.hit);
    pinT = RING.pin;
    return t;
  };

  R.dispose = () => {
    if (disposed) return; disposed = true;
    canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointerleave', onLeave); removeEventListener('resize', onResize);
    if (cardEl) { cardEl.classList.remove('ringed'); cardEl = null; }
    group.removeFromParent(); loopGeo.dispose(); groundGeo.dispose(); loopMat.dispose(); ghostMat.dispose(); haloMat.dispose(); groundMat.dispose();
    spareMat.dispose(); frameMat.dispose();          // (the frame pictures are shared by every ring and kept)
    R.target = null;
  };
  return R;
}
