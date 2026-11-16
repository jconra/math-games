// MATHBALL, DRAWN: the live parts of the court over the kit's room (kit/arena.js): the hexagon floor's light, the balls,
// the goals' signs, the light bar and the ports' flashes. The round itself is game.js; this only shows it.
//
// THE FLOOR (the game's maker, AR2-1: "a combination of A and D where there is a constant glow from each side (or goal,
// like C) that fades towards the center. But each time a goal is made it would be cool to have the hexagons animate by
// lighting up from where the player is standing and create a light path to the goal that was scored ... a 'strike'
// through the floor lighting, and then go back to normal"): one flat shape over the court, its light worked out in a
// shader and added onto the dark floor: the hexagons' seams, each goal's colour strongest at its mouth and fading
// toward the middle, the court's edge line and middle ring, and up to two strikes at once.
// THE BALLS (AR2-4/5/6: "a dark color ball with a white number", "lit on dark", "bigger (like a beach ball size)"): a
// dark coloured ball with its number big and white on two opposite sides, softly lit so it reads in the dark room and
// stays under the bloom (nothing smears the digits). Turned as physics.js turns them.
// THE SIGNS: each goal's rule on its board (the words small over the number big, in the goal's colour), redrawn when
// the rule changes, with a flash and a flicker.
// THE LIGHT BAR (AR3-3: "a light bar that traveled around the room above the goals and that represented the timer"):
// a bright run of light along the rail round the room, in the colour of the goal it is going to; it lights that goal's
// sign up as it arrives.
//
//   const V = makeView({ W, G })      W: the station (station.js), G: the round (game.js)
//   V.update(dt, camera)              each frame, after the round has stepped
//   V.sees(ball)                      is a ball in the camera's view (physics.js's balls face it when it is not)
//   V.ballMesh(id) / V.targets()      for clicks: the balls' meshes and the goals' click boxes
//   V.strike(fromXZ, goal, who)       start a strike
//   V.dispose()
import * as THREE from 'three';
import { COURT, GOALS, PORTS, TRACK, CORNERS, WALLS, toStation } from './court.js';
import { ruleOf } from './rules.js';

const MID = COURT.mid;
// (dark, and none the hue of a goal's colour: pink, violet, gold, green; so a ball's colour never says which goal)
export const BALL_COLOURS = ['#b5172f', '#1f4dc2', '#0b7f86', '#c2560f', '#6e4420', '#33577f'];
const lin = (hex) => { const c = new THREE.Color(hex); return new THREE.Vector3(c.r, c.g, c.b); };

// ── THE FLOOR ──────────────────────────────────────────────────────────────────────────────────────────────────────
const FLOOR_VS = `
varying vec2 vP;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xz - uMid; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FLOOR_FS = `
varying vec2 vP;
uniform float uTime, uR;
uniform vec2 uGoal[4]; uniform vec3 uGoalCol[4]; uniform float uFlash[4];
uniform vec4 uStrikeAB[2]; uniform vec3 uStrikeCol[2]; uniform float uStrikeT[2];
uniform vec4 uWall[8];   // (each wall: a point on it, its inward normal)
uniform vec3 uBase, uEdge, uRing;
// the nearest hexagon's middle (pointy along z): the two staggered lattices, the nearer of their nearest points
vec2 hexMid(vec2 p) {
  vec2 s = vec2(1.7320508 * uR, 3.0 * uR);
  vec2 a = s * floor(p / s + 0.5);
  vec2 b = s * floor((p - s * 0.5) / s + 0.5) + s * 0.5;
  return dot(p - a, p - a) < dot(p - b, p - b) ? a : b;
}
float hash(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 c = hexMid(vP), q = abs(vP - c);
  // (how far in from the hexagon's edge: its flat sides face x, and 60 degrees either side)
  float inr = uR * 0.8660254, e = inr - max(q.x, dot(q, vec2(0.5, 0.8660254)));
  float fw = fwidth(e) * 1.2, seam = 1.0 - smoothstep(0.012, 0.012 + fw, e);
  // how far inside the court (the nearest wall), and the court's edge line half a metre in
  float din = 1e9; for (int i = 0; i < 8; i++) din = min(din, dot(vP - uWall[i].xy, uWall[i].zw));
  if (din < 0.0) discard;
  float edgeW = fwidth(din) * 1.2, edge = (1.0 - smoothstep(0.045, 0.045 + edgeW, abs(din - 0.55)));
  float onCourt = smoothstep(0.42, 0.62, din);
  // the goals' colour: strongest at each mouth, fading toward the middle (seams and a soft fill of each hexagon)
  vec3 seamC = uBase, fill = vec3(0.0); float wMax = 0.0;
  for (int g = 0; g < 4; g++) {
    float d = length(c - uGoal[g]), w = 1.0 - smoothstep(0.6, 6.2, d), fl = uFlash[g];
    float lift = 1.0 + max(fl, 0.0) * 1.6;
    vec3 col = fl < 0.0 ? mix(uGoalCol[g], vec3(1.6, 0.12, 0.08), -fl) : uGoalCol[g];
    if (w > wMax) { wMax = w; seamC = mix(uBase, col * lift, w); }
    fill += col * 0.11 * pow(w, 1.6) * lift;
  }
  // the middle ring
  float r = length(vP), ring = 1.0 - smoothstep(0.03, 0.03 + fwidth(r) * 1.2, abs(r - 1.2));
  // the strikes: whole hexagons lighting along the way from the thrower to the goal, a front running at 13 m/s, each
  // fading behind it; a burst round where the thrower stood
  vec3 hit = vec3(0.0); float hitSeam = 0.0;
  for (int k = 0; k < 2; k++) {
    float t = uTime - uStrikeT[k]; if (t < 0.0 || t > 3.0) continue;
    vec2 A = uStrikeAB[k].xy, B = uStrikeAB[k].zw, D = B - A; float L = length(D); vec2 dir = D / max(L, 1e-3), nrm = vec2(-dir.y, dir.x);
    float s = dot(c - A, dir), side = dot(c - A, nrm) - sin(s * 1.15 + float(k) * 2.0) * 0.55;
    float onPath = (1.0 - smoothstep(0.55, 0.85, abs(side))) * step(-0.8, s) * step(s, L + 0.6);
    float lit = t - max(s, 0.0) / 13.0;
    float k1 = onPath * smoothstep(0.0, 0.06, lit) * exp(-max(lit, 0.0) * 1.7);
    float burst = (1.0 - smoothstep(0.3, 1.5, length(c - A))) * smoothstep(0.0, 0.05, t) * exp(-t * 2.2);
    float kk = max(k1, burst);
    hit += uStrikeCol[k] * kk; hitSeam = max(hitSeam, kk);
  }
  vec3 col = (seamC * seam + fill * (1.0 - seam)) * onCourt + uEdge * edge + uRing * ring * onCourt;
  col += hit * (0.42 + seam * 1.6);
  // (a slow shimmer down the seams, so the floor is never quite still)
  col *= 0.92 + 0.08 * sin(uTime * 0.7 + hash(c) * 6.283);
  gl_FragColor = vec4(col, 1.0);
}`;

function makeFloor() {
  // the court's outline as a fan, a little above the kit's floor
  // (the shape is drawn in x and -z, then laid flat facing up: its y becomes -z)
  const pts = CORNERS.map(([x, z]) => new THREE.Vector2(x, -z)), shape = new THREE.Shape(pts);
  const g = new THREE.ShapeGeometry(shape); g.rotateX(-Math.PI / 2);
  g.translate(MID[0], 0.006, MID[2]);
  const U = {
    uMid: { value: new THREE.Vector2(MID[0], MID[2]) }, uTime: { value: 0 }, uR: { value: COURT.hex.r },
    uGoal: { value: GOALS.map((G) => new THREE.Vector2(G.mid[0] - G.n[0] * 0.2, G.mid[1] - G.n[1] * 0.2)) },
    uGoalCol: { value: GOALS.map((G) => new THREE.Vector3(...G.glow).multiplyScalar(0.62)) },
    uFlash: { value: [0, 0, 0, 0] },
    uStrikeAB: { value: [new THREE.Vector4(), new THREE.Vector4()] }, uStrikeCol: { value: [new THREE.Vector3(), new THREE.Vector3()] }, uStrikeT: { value: [-99, -99] },
    uWall: { value: WALLS.map((W) => new THREE.Vector4(W.A[0], W.A[1], W.n[0], W.n[1])) },
    uBase: { value: new THREE.Vector3(0.03, 0.2, 0.38) }, uEdge: { value: new THREE.Vector3(0.06, 0.62, 1.25) }, uRing: { value: new THREE.Vector3(0.8, 0.86, 0.95) },
  };
  const m = new THREE.ShaderMaterial({
    uniforms: U, vertexShader: 'uniform vec2 uMid;\n' + FLOOR_VS, fragmentShader: FLOOR_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, extensions: { derivatives: true },
  });
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 1; mesh.name = 'mathball floor'; mesh.frustumCulled = false;
  return { mesh, U };
}

// ── THE LIGHT BAR ──────────────────────────────────────────────────────────────────────────────────────────────────
// a ribbon along the rail (its face, just proud of the wall), each vertex knowing how far along the track it is
function makeBar() {
  const P = [], S = [], I = [], y = COURT.bar.y, h = 0.045, out = 0.004;
  const steps = []; for (let s = 0; s <= TRACK.len + 1e-6; s += 0.12) steps.push(Math.min(s, TRACK.len));
  // (the corners exactly, so the ribbon turns with the walls)
  for (const a of TRACK.at) steps.push(a);
  steps.sort((a, b) => a - b);
  const at = (s) => {
    for (let i = 1; i < TRACK.pts.length; i++) if (s <= TRACK.at[i] + 1e-9) { const f = (s - TRACK.at[i - 1]) / (TRACK.at[i] - TRACK.at[i - 1] || 1); return [TRACK.pts[i - 1][0] + (TRACK.pts[i][0] - TRACK.pts[i - 1][0]) * f, TRACK.pts[i - 1][1] + (TRACK.pts[i][1] - TRACK.pts[i - 1][1]) * f]; }
    return TRACK.pts[TRACK.pts.length - 1];
  };
  for (const s of steps) {
    const [ix, iz] = at(s);
    // (pushed in from the wall along its normal: the nearest wall's)
    let nx = 0, nz = 0, best = Infinity; for (const W of WALLS) { const d = Math.abs(W.n[0] * (ix - W.A[0]) + W.n[1] * (iz - W.A[1])); if (d < best) { best = d; nx = W.n[0]; nz = W.n[1]; } }
    const px = ix + nx * out + MID[0], pz = iz + nz * out + MID[2];
    P.push(px, y - h, pz, px, y + h, pz); S.push(s, s);
  }
  for (let i = 0; i < steps.length - 1; i++) { const a = i * 2; I.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aS', new THREE.Float32BufferAttribute(S, 1)); g.setIndex(I);
  const U = { uHead: { value: 0 }, uCol: { value: new THREE.Vector3(1, 1, 1) }, uTime: { value: 0 }, uLen: { value: TRACK.len } };
  const m = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'attribute float aS; varying float vS; void main() { vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying float vS; uniform float uHead, uTime, uLen; uniform vec3 uCol;
      void main() {
        float d = uHead - vS;                       // (metres behind the bar's head)
        float head = (1.0 - smoothstep(0.55, 0.75, abs(d - 0.35))) * 2.4;   // (the bar: 1.4 m of bright light)
        float tail = d > 0.0 ? exp(-d * 0.55) * 0.9 : 0.0;                    // (fading behind it)
        float k = max(head, tail) + 0.05;                                       // (the whole rail faintly lit)
        gl_FragColor = vec4(uCol * k, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.name = 'mathball bar'; mesh.frustumCulled = false; mesh.renderOrder = 2;
  return { mesh, U };
}

// ── THE SIGNS ──────────────────────────────────────────────────────────────────────────────────────────────────────
const SIGN_W = 1024, SIGN_H = 296;
function drawSign(cv, rule, css, k = 1) {
  const g = cv.getContext('2d'), R = ruleOf(rule);
  g.clearRect(0, 0, SIGN_W, SIGN_H);
  g.fillStyle = css; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const font = (px) => `800 ${px}px "DejaVu Sans", "Segoe UI", system-ui, sans-serif`;
  const fit = (text, px, maxW) => { g.font = font(px); const w = g.measureText(text).width; return w > maxW ? px * maxW / w : px; };
  g.globalAlpha = k;
  if (R.sign.length === 2) {
    const a = fit(R.sign[0], 74, SIGN_W - 80); g.font = font(a); g.fillText(R.sign[0], SIGN_W / 2, 92);
    const b = fit(R.sign[1], 176, SIGN_W - 80); g.font = font(b); g.fillText(R.sign[1], SIGN_W / 2, 262);
  } else {
    const words = R.sign[0].split(' ');
    if (words.length === 2) {
      const a = Math.min(fit(words[0], 118, SIGN_W - 80), fit(words[1], 118, SIGN_W - 80));
      g.font = font(a); g.fillText(words[0], SIGN_W / 2, 132); g.fillText(words[1], SIGN_W / 2, 262);
    } else { const a = fit(R.sign[0], 130, SIGN_W - 80); g.font = font(a); g.fillText(R.sign[0], SIGN_W / 2, 196); }
  }
  g.globalAlpha = 1;
}
// a goal's colour as the sign's letters: its light, lightened so it reads on the dark board
const inkOf = (glow) => { const m = Math.max(...glow), c = glow.map((v) => v / m); return `rgb(${c.map((v) => Math.round(255 * (0.55 + 0.45 * v))).join(',')})`; };

function makeSign(G) {
  const cv = document.createElement('canvas'); cv.width = SIGN_W; cv.height = SIGN_H;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: new THREE.Color(1.5, 1.5, 1.5), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const B = COURT.goal.board, mesh = new THREE.Mesh(new THREE.PlaneGeometry(B.w - 0.12, (B.w - 0.12) * SIGN_H / SIGN_W), mat);
  // in the goal's frame: on the board's face (centre B.y, B.z, leaning out by B.tilt), then into the station
  const tilt = B.tilt, n = [0, -Math.sin(tilt), Math.cos(tilt)], c = [0, B.y + n[1] * 0.04, B.z + n[2] * 0.04];
  const ry = Math.atan2(G.n[0], G.n[1]), ca = Math.cos(ry), sa = Math.sin(ry);
  mesh.position.set(MID[0] + G.mid[0] + c[2] * sa, c[1], MID[2] + G.mid[1] + c[2] * ca);
  mesh.rotation.set(0, ry, 0, 'YXZ'); mesh.rotateX(tilt);
  mesh.name = 'mathball sign ' + G.key; mesh.renderOrder = 3;
  const css = inkOf(G.glow);
  return { mesh, cv, tex, css, rule: null, flash: 0, swapT: -1, next: null, glow: 0 };
}

// ── THE BALLS ──────────────────────────────────────────────────────────────────────────────────────────────────────
// two half-spheres, each mapped flat from the front (so the number is undistorted face on): the front half on the left
// of the picture, the back on the right (mirrored, so it reads the right way round from behind)
const BALL_GEO = (() => {
  const P = [], N = [], UV = [], I = [], rings = 14, segs = 40, R = COURT.ball.r;
  for (const side of [1, -1]) {
    const base = P.length / 3;
    for (let i = 0; i <= rings; i++) {
      const th = (i / rings) * Math.PI / 2, st = Math.sin(th), ct = Math.cos(th);
      for (let j = 0; j <= segs; j++) {
        const ph = (j / segs) * Math.PI * 2, x = st * Math.cos(ph), y = st * Math.sin(ph), z = ct * side;
        P.push(x * R, y * R, z * R); N.push(x, y, z);
        UV.push(side > 0 ? 0.25 + 0.25 * x : 0.75 - 0.25 * x, 0.5 + 0.5 * y);
      }
    }
    for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) {
      const a = base + i * (segs + 1) + j, b = a + segs + 1;
      if (side > 0) I.push(a, b, a + 1, b, b + 1, a + 1); else I.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I);
  g.computeBoundingSphere();
  return g;
})();
// a number that reads as another upside down gets a line under it (6, 9, 16, 86 ...)
const FLIP = { 0: '0', 1: '1', 6: '9', 8: '8', 9: '6' };
export const needsBar = (s) => { const t = String(s); return t.length > 0 && [...t].every((c) => c in FLIP) && [...t].reverse().map((c) => FLIP[c]).join('') !== t; };
function ballTextures(num, colour) {
  const S = 256, cv = document.createElement('canvas'); cv.width = S * 2; cv.height = S;
  const em = document.createElement('canvas'); em.width = S * 2; em.height = S;
  const g = cv.getContext('2d'), e = em.getContext('2d'), text = String(num);
  g.fillStyle = colour; g.fillRect(0, 0, S * 2, S); e.fillStyle = '#000'; e.fillRect(0, 0, S * 2, S);
  // digits as tall as they can be: one digit 0.62 of the face, narrower for two and three (as a pool ball's)
  const h = S * 0.6, squeeze = text.length >= 3 ? 0.62 : text.length === 2 ? 0.84 : 1;
  for (const [ctx, ink] of [[g, '#ffffff'], [e, '#ffffff']]) {
    ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.round(h)}px "DejaVu Sans", "Segoe UI", system-ui, sans-serif`;
    for (const k of [0, 1]) {
      ctx.save(); ctx.translate(S * (k + 0.5), S * 0.5 + h * 0.04); ctx.scale(squeeze, 1);
      ctx.fillText(text, 0, 0);
      if (needsBar(text)) { const w = ctx.measureText(text).width; ctx.fillRect(-w / 2, h * 0.44, w, h * 0.075); }
      ctx.restore();
    }
  }
  const map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const emap = new THREE.CanvasTexture(em); emap.colorSpace = THREE.SRGBColorSpace; emap.anisotropy = 8;
  return { map, emap };
}

// ── THE PORTS' FLASHES ─────────────────────────────────────────────────────────────────────────────────────────────
function makePortRings() {
  const geo = new THREE.RingGeometry(0.36, 0.5, 40);
  return PORTS.map((P) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.6, 2.8), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.position.set(MID[0] + P.at[0] + P.n[0] * 0.12, P.at[1], MID[2] + P.at[2] + P.n[2] * 0.12);
    m.lookAt(m.position.x + P.n[0], m.position.y, m.position.z + P.n[2]);
    m.k = 0; m.name = 'mathball port'; return m;
  });
}

// ── all of it ──────────────────────────────────────────────────────────────────────────────────────────────────────
export function makeView({ W, G: G0 }) {
  let G = G0;
  const group = new THREE.Group(); group.name = 'mathball'; W.scene.add(group);
  const floor = makeFloor(), bar = makeBar(), ports = makePortRings();
  group.add(floor.mesh, bar.mesh, ...ports);
  const signs = GOALS.map((g) => { const s = makeSign(g); group.add(s.mesh); return s; });
  // the goals' click boxes: the mouth and its board (never drawn)
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hits = GOALS.map((g, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(COURT.goal.w + 0.8, 3.0, 0.9), hitMat);
    const ry = Math.atan2(g.n[0], g.n[1]);
    m.position.set(MID[0] + g.mid[0] + g.n[0] * 0.3, 1.5, MID[2] + g.mid[1] + g.n[1] * 0.3); m.rotation.set(0, ry, 0);
    m.name = 'mathball goal ' + g.key; m.userData.goal = i; group.add(m); return m;
  });
  // the players' rings on the floor: cyan for you, orange for the other player
  const ringGeo = new THREE.RingGeometry(0.42, 0.5, 40).rotateX(-Math.PI / 2);
  const ringOf = (c) => { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })); m.renderOrder = 2; group.add(m); return m; };
  const youRing = ringOf(new THREE.Color(0.1, 0.9, 1.8)), themRing = ringOf(new THREE.Color(1.8, 0.55, 0.06));
  const balls = new Map();
  const env = W.envAt(new THREE.Vector3(MID[0], 1.5, MID[2]));
  let t = 0, strikeK = 0;
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), sph = new THREE.Sphere(new THREE.Vector3(), COURT.ball.r * 1.4);

  function ballMeshFor(b) {
    let M = balls.get(b.id);
    if (M) return M;
    const tx = ballTextures(b.num, BALL_COLOURS[b.colour % BALL_COLOURS.length]);
    const mat = new THREE.MeshStandardMaterial({ map: tx.map, emissiveMap: tx.emap, emissive: new THREE.Color(0.85, 0.85, 0.85), roughness: 0.38, metalness: 0.05, envMap: env, envMapIntensity: 2.2 });
    // (the body glows faintly in its own colour, so a dark ball still reads against the dark floor)
    const body = new THREE.Color(BALL_COLOURS[b.colour % BALL_COLOURS.length]);
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uBody = { value: new THREE.Vector3(body.r, body.g, body.b) };
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uBody;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.0); totalEmissiveRadiance += uBody * (0.16 + rim * 0.5); }');
    };
    const mesh = new THREE.Mesh(BALL_GEO, mat); mesh.name = 'mathball ball ' + b.num; mesh.userData.ball = b.id;
    group.add(mesh);
    M = { mesh, tx, mat, born: t, gone: 0 };
    balls.set(b.id, M);
    return M;
  }
  function dropBall(id) { const M = balls.get(id); if (!M) return; group.remove(M.mesh); M.mat.dispose(); M.tx.map.dispose(); M.tx.emap.dispose(); balls.delete(id); }

  function setSign(i, rule, flash = false) {
    const S = signs[i]; S.rule = rule; drawSign(S.cv, rule, S.css); S.tex.needsUpdate = true;
    if (flash) S.flash = 1;
  }
  GOALS.forEach((g, i) => setSign(i, G.goals[i].rule));

  const V = {
    group,
    // a new round on the same court (the signs show its goals at once)
    use(G1) { G = G1; GOALS.forEach((g, i) => { signs[i].swapT = -1; signs[i].next = null; setSign(i, G.goals[i].rule); }); for (const id of [...balls.keys()]) dropBall(id); },
    get round() { return G; },
    sees(b) {
      if (!b || !b.p) return false;
      sph.center.set(MID[0] + b.p[0], b.p[1], MID[2] + b.p[2]);
      return frustum.intersectsSphere(sph);
    },
    ballMesh: (id) => (balls.get(id) || {}).mesh || null,
    goalHits: hits,
    // a strike from where the thrower stood (court frame x, z) to a goal
    strike(from, gi, colourK = 1) {
      const k = strikeK++ % 2, g = GOALS[gi];
      floor.U.uStrikeAB.value[k].set(from[0], from[1], g.mid[0] - g.n[0] * 0.3, g.mid[1] - g.n[1] * 0.3);
      floor.U.uStrikeCol.value[k].set(...g.glow).multiplyScalar(0.9 * colourK);
      floor.U.uStrikeT.value[k] = t;
    },
    // the rule a goal is changing to: the sign flickers and settles on it
    change(gi, rule) { const S = signs[gi]; S.next = rule; S.swapT = 0; },
    update(dt, camera) {
      t += dt;
      camera.updateMatrixWorld(); pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pv);
      floor.U.uTime.value = t;
      for (let i = 0; i < 4; i++) floor.U.uFlash.value[i] = G.goals[i].flash;
      // the bar: where it is, in the colour of the goal it is heading for (white once past the last)
      bar.U.uTime.value = t; bar.U.uHead.value = G.barS();
      const nx = G.next();
      const col = nx.goal != null ? GOALS[nx.goal].glow : [1.5, 1.6, 1.7], m = Math.max(...col);
      bar.U.uCol.value.set(col[0] / m * 1.6, col[1] / m * 1.6, col[2] / m * 1.6);
      // the signs: the next one to change brightens as the bar nears (its last 3 seconds); a change flickers in
      for (let i = 0; i < 4; i++) {
        const S = signs[i];
        const near = nx.goal === i && nx.left != null && nx.left < 3 ? 1 - nx.left / 3 : 0;
        if (S.swapT >= 0) {
          S.swapT += dt;
          // (a flicker: the old rule and the new one by turns, a sixth of a second each, for under a second)
          const k = Math.floor(S.swapT * 9);
          if (S.swapT > 0.75) { setSign(i, S.next, true); S.swapT = -1; S.next = null; }
          else { drawSign(S.cv, k % 2 ? S.next : S.rule, S.css, 0.55 + 0.45 * (k % 2)); S.tex.needsUpdate = true; }
        }
        S.flash *= Math.exp(-2.5 * dt);
        const pulse = near * (0.5 + 0.5 * Math.sin(t * 12)), b = 1.5 + S.flash * 1.4 + pulse * 0.8 + Math.max(0, G.goals[i].flash) * 0.6;
        S.mesh.material.color.setRGB(b, b, b);
      }
      // the ports
      for (const p of ports) { p.k *= Math.exp(-5 * dt); p.material.opacity = Math.min(1, p.k); p.visible = p.k > 0.01; }
      // the balls
      const seen = new Set();
      for (const b of G.balls) {
        if (b.mode === 'gone') continue;
        seen.add(b.id);
        const M = ballMeshFor(b), mesh = M.mesh;
        mesh.position.set(MID[0] + b.p[0], b.p[1], MID[2] + b.p[2]);
        mesh.quaternion.set(b.q[0], b.q[1], b.q[2], b.q[3]);
        // (out of a port it grows from small; into a goal it shrinks away; swapped out, it fades to nothing)
        let s = Math.min(1, 0.35 + (t - M.born) * 5);
        if (b.mode === 'in') s *= Math.max(0, 1 - (G.t - b.inAt) / 0.7);
        if (b.fading) { const f = Math.max(0, 1 - (G.t - b.fading) / 0.8); s *= f; mesh.material.emissive.setScalar(0.85 + (1 - f) * 2); }
        mesh.scale.setScalar(Math.max(0.001, s));
      }
      for (const id of [...balls.keys()]) if (!seen.has(id)) dropBall(id);
      // the players' rings
      youRing.position.set(MID[0] + G.you.x, 0.012, MID[2] + G.you.z);
      themRing.position.set(MID[0] + G.other.x, 0.012, MID[2] + G.other.z);
    },
    flashPort(i) { const p = ports[i]; if (p) p.k = 1.6; },
    // a held ball turned to show its number to the camera (upright)
    facing(b, camera) {
      const p = new THREE.Vector3(MID[0] + b.p[0], b.p[1], MID[2] + b.p[2]), f = camera.position.clone().sub(p).normalize();
      const up = new THREE.Vector3(0, 1, 0).addScaledVector(f, -f.y).normalize(), x = new THREE.Vector3().crossVectors(up, f);
      const m = new THREE.Matrix4().makeBasis(x, up, f), q = new THREE.Quaternion().setFromRotationMatrix(m);
      b.q = [q.x, q.y, q.z, q.w];
    },
    dispose() {
      for (const id of [...balls.keys()]) dropBall(id);
      W.scene.remove(group);
      floor.mesh.geometry.dispose(); floor.mesh.material.dispose(); bar.mesh.geometry.dispose(); bar.mesh.material.dispose();
      for (const S of signs) { S.tex.dispose(); S.mesh.material.dispose(); S.mesh.geometry.dispose(); }
      for (const p of ports) p.material.dispose();
      hitMat.dispose(); ringGeo.dispose(); youRing.material.dispose(); themRing.material.dispose();
    },
  };
  return V;
}
// (the court's frame to the station's, for the page)
export { toStation };
