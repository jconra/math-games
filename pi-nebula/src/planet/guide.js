// THE WAY TO THE WRECK, DRAWN (its plain part, the colour and the sums: src/planet/guideplan.js). Over a planet, once
// the sensors have found the wreck (the sensors' card: src/jobs/sensors.js):
//   - THE BEAM: a tall column of light standing on the wreck and going up into space (the game's maker, RESC1-3: "a big
//     beam marking the target area, like a green column that goes into space"), in the way's colour for this planet;
//     it rises from the ground as the wreck is found. Seen from far off it is never thinner than a few pixels; close by
//     it is softer, so it does not hide the wreck or the ground to set down on.
//   - THE ARROW, over the view, in the same colour with a dark edge (never the ground's colour: his words), and how far:
//     over the wreck while it is in sight, at the edge of the view pointing round toward it when it is not.
//   - THE RADAR, the ship's own (heading up): the ship in its middle, the wreck a dot; past its reach, on its rim. Drawn
//     by drawRadar, which draws into any 2D picture: here the lab's own small screen in the corner (the dashboard's
//     tiny ship screen is the game's, src/flying.js, and is not in the lab).
//   - THE BLUE SHIP TO SET DOWN ON (the hangar's landing guide, src/flying.js: "Line up with the blue ship"): the same
//     see-through blue ship with its edges drawn, life size, standing on the level ground beside the wreck that the
//     planet keeps for landing (land.landing), its side with the ramps toward the stasis pods.
// None of it is drawn with the planet's haze or light: it is the ship's own sight laid over the world, as the hangar's
// guide is. It does bend with the planet's curve, as everything on the ground does (src/planet/ground.js CURVE), so
// it stands on the ground however far off it is.
//
//   const G = makeWreckGuide({ scene, ground, land, colour, at, root, bounds })
//     colour   guideplan.js guideColour(palette); at: [x, y, z] the wreck; bounds() the part of the screen the arrow
//              keeps to: { left, top, right, bottom } (CSS px)
//   G.show(on)                  the radar up (sweeping, until the wreck is found)
//   G.light(on)                 the way lit (rising) or put out
//   G.update(camera, dt, { ahead })   each frame, after the camera; ahead: the ship's nose's way [x, z] (the camera's)
//   G.goal({ cfg, landing, toward })  the blue ship on the landing place (cfg: the ship's flight facts, src/fleet.js
//                                     flightOf; toward: [x, z] the pods' middle, which its ramps face); null: none
//   G.state(), G.dispose()
import * as THREE from 'three';
import { offsetTo, shipFrame, radarDot, distWords, edgeSpot, inBox, RADAR } from './guideplan.js';
import { modelShape, HOLO, GOAL } from '../flying.js';
import { facing } from '../flymodel.js';
import { padNose } from './landing.js';

// the beam: how tall (m: up past the clouds, into space), how wide on the ground (m) and never thinner than `px` on the
// screen; how long it takes to rise (s); close by, it fades to `near` of itself within `soft` metres (across the ground)
export const BEAM = { height: 2600, width: 12, px: 7, rise: 1.6, near: 0.32, soft: [60, 220], segments: 32 };
// the arrow: how far over the wreck it hangs (px), the dead space round the screen's edge (px); shown until the ship is
// within `there` metres of the wreck across the ground (the blue ship takes over)
export const ARROW = { over: 34, edge: 34, there: 70 };

const BEAM_VERT = /* glsl */`
  uniform vec3 uBase, uCam; uniform float uHeight, uWidth, uPx, uCurve, uRise;
  attribute vec2 aBeam;
  varying vec2 vB; varying float vH;
  void main() {
    float h = aBeam.y * uHeight * uRise;
    vec3 p = vec3(uBase.x, uBase.y + h, uBase.z);
    vec2 d = p.xz - uCam.xz; float L = length(d);
    vec2 side = L > 0.001 ? vec2(-d.y, d.x) / L : vec2(1.0, 0.0);
    float w = max(uWidth, length(p - uCam) * uPx);
    p.xz += side * aBeam.x * w * 0.5;
    vec2 dw = p.xz - uCam.xz; p.y -= dot(dw, dw) * uCurve;
    vB = aBeam; vH = h;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }`;
// (a bright core, white at its heart, a soft glow either side; strongest at the ground, fading out high up; a slow pulse
// climbing it. Its colour is written as it is: the way's colour on the screen is the one picked for the planet)
const BEAM_FRAG = /* glsl */`
  uniform vec3 uColour; uniform float uTime, uOpacity;
  varying vec2 vB; varying float vH;
  void main() {
    float a = abs(vB.x);
    float core = 1.0 - smoothstep(0.0, 0.32, a);
    float glow = 1.0 - smoothstep(0.15, 1.0, a);
    float up = (1.0 - smoothstep(0.3, 1.0, vB.y)) * (0.55 + 0.45 * (1.0 - smoothstep(0.0, 0.08, vB.y)));
    float pulse = 0.8 + 0.2 * sin(uTime * 2.4 - vH * 0.03);
    vec3 c = mix(uColour, vec3(1.0), core * 0.6);
    float alpha = (glow * 0.5 + core * 0.5) * up * pulse * uOpacity;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(c, alpha);
  }`;
function beamGeometry(n) {
  const pos = [], ab = [], ix = [];
  for (let i = 0; i <= n; i++) {
    const t = Math.pow(i / n, 1.7);      // (more of its points low down, where it is seen close)
    for (const s of [-1, 1]) { pos.push(0, 0, 0); ab.push(s, t); }
    if (i) { const k = (i - 1) * 2; ix.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aBeam', new THREE.Float32BufferAttribute(ab, 2));
  g.setIndex(ix);
  return g;
}

// (a basic material bent with the planet's curve, as the ground is: the ground's own shared numbers)
function bent(mat, U) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uCam = U.uCam; sh.uniforms.uCurve = U.uCurve;
    sh.vertexShader = 'uniform vec3 uCam; uniform float uCurve;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      { vec4 wp = modelMatrix * vec4(transformed, 1.0); vec2 d = wp.xz - uCam.xz;
        mvPosition.xyz -= (viewMatrix * vec4(0.0, dot(d, d) * uCurve, 0.0, 0.0)).xyz; gl_Position = projectionMatrix * mvPosition; }`);
  };
  mat.customProgramCacheKey = () => 'planet-guide-bent';
  return mat;
}

const CSS = `
.pg-way { position: fixed; left: 0; top: 0; z-index: 18; pointer-events: none; will-change: transform; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.pg-way[hidden] { display: none; }
.pg-way svg { display: block; width: 34px; height: 34px; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.7)); }
.pg-way b { font: 800 13.5px/1 "Segoe UI", system-ui, sans-serif; letter-spacing: 0.04em; color: var(--pg); padding: 4px 8px 5px; background: rgba(6, 9, 13, 0.82); white-space: nowrap;
  box-shadow: inset 0 0 0 1.5px var(--pg); clip-path: polygon(6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px), 0 6px); }
.pg-way.is-edge { flex-direction: row; }
.pg-radar { position: fixed; z-index: 18; right: max(12px, env(safe-area-inset-right)); top: 12px; pointer-events: none; display: flex; flex-direction: column; align-items: center; gap: 3px; }
.pg-radar[hidden] { display: none; }
.pg-radar canvas { display: block; }
.pg-radar small { font: 700 10.5px/1 "Segoe UI", system-ui, sans-serif; letter-spacing: 0.12em; text-transform: uppercase; color: #9fb3c6; text-shadow: 0 1px 2px #000; }
`;

// THE RADAR, drawn into a 2D picture (the lab's corner here; the dashboard's tiny ship screen could draw it the same):
// a dark round screen of radius R at (cx, cy), a ring at half its reach, the ship in its middle pointing up, and
// dot: { x, y, beyond } (radarDot) in `colour`, or none (still searching: a sweep goes round); clock: seconds, for it
export function drawRadar(g, cx, cy, R, { dot = null, colour = '#45ff6b', clock = 0, ring = 0.5 } = {}) {
  g.save();
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fillStyle = 'rgba(6, 10, 15, 0.84)'; g.fill();
  g.lineWidth = Math.max(1.5, R * 0.03); g.strokeStyle = 'rgba(150, 210, 250, 0.55)'; g.stroke();
  g.beginPath(); g.arc(cx, cy, R * ring, 0, Math.PI * 2); g.lineWidth = 1; g.strokeStyle = 'rgba(150, 210, 250, 0.22)'; g.stroke();
  g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.strokeStyle = 'rgba(150, 210, 250, 0.12)'; g.stroke();
  if (!dot) {
    // (searching: a soft wedge sweeping round)
    const a = (clock * 1.8) % (Math.PI * 2), grd = g.createConicGradient ? g.createConicGradient(a - 0.9, cx, cy) : null;
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R * 0.96, a - 0.9, a); g.closePath();
    if (grd) { grd.addColorStop(0, 'rgba(150, 210, 250, 0)'); grd.addColorStop(0.143, 'rgba(150, 210, 250, 0.32)'); grd.addColorStop(0.15, 'rgba(150, 210, 250, 0)'); g.fillStyle = grd; } else g.fillStyle = 'rgba(150, 210, 250, 0.16)';
    g.fill();
  }
  // the ship, nose up
  const s = R * 0.13;
  g.beginPath(); g.moveTo(cx, cy - s * 1.25); g.lineTo(cx + s * 0.8, cy + s); g.lineTo(cx, cy + s * 0.5); g.lineTo(cx - s * 0.8, cy + s); g.closePath();
  g.fillStyle = '#e8f2fa'; g.fill();
  if (dot) {
    const x = cx + dot.x * R * 0.94, y = cy - dot.y * R * 0.94, r = Math.max(3.5, R * 0.085);
    g.lineWidth = Math.max(1.5, R * 0.035); g.strokeStyle = '#05080c'; g.fillStyle = colour;
    if (dot.beyond) {
      // (further than it reaches: a pointer on its rim, the way to turn)
      const ang = Math.atan2(-dot.y, dot.x);
      g.translate(x, y); g.rotate(ang);
      g.beginPath(); g.moveTo(r * 1.5, 0); g.lineTo(-r * 0.9, -r * 1.1); g.lineTo(-r * 0.4, 0); g.lineTo(-r * 0.9, r * 1.1); g.closePath(); g.stroke(); g.fill();
    } else { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); g.fill(); }
  }
  g.restore();
}

export function makeWreckGuide({ scene, ground, colour, at, root = document.body, bounds = null, label = 'Wreck' }) {
  if (!document.getElementById('pg-css')) { const st = document.createElement('style'); st.id = 'pg-css'; st.textContent = CSS; document.head.appendChild(st); }
  const U = ground.U, rgb = colour.rgb, hex = colour.hex;
  let lit = false, rise = 0, clock = 0, closed = false, on = false;
  const target = new THREE.Vector3(...at);

  // ── the beam ──
  const beam = new THREE.Mesh(beamGeometry(BEAM.segments), new THREE.ShaderMaterial({
    vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { uBase: { value: target.clone().setY(target.y - 1.5) }, uCam: U.uCam, uCurve: U.uCurve, uHeight: { value: BEAM.height }, uWidth: { value: BEAM.width }, uPx: { value: 0.01 },
      uRise: { value: 0 }, uColour: { value: new THREE.Vector3(...rgb) }, uTime: { value: 0 }, uOpacity: { value: 0 } },
  }));
  beam.frustumCulled = false; beam.renderOrder = 6; beam.name = 'the way: the beam'; beam.visible = false;
  scene.add(beam);

  // ── the arrow and the radar, over the view ──
  const way = document.createElement('div'); way.className = 'pg-way'; way.hidden = true; way.style.setProperty('--pg', hex);
  way.innerHTML = `<b></b><svg viewBox="-17 -17 34 34" aria-hidden="true"><path d="M-12 -9 L0 9 L12 -9 L0 -3 Z" fill="${hex}" stroke="#05080c" stroke-width="2.6" stroke-linejoin="round"/></svg>`;
  way.setAttribute('role', 'img');
  const wayWords = way.querySelector('b'), wayArrow = way.querySelector('svg');
  root.appendChild(way);
  const radar = document.createElement('div'); radar.className = 'pg-radar'; radar.hidden = true;
  radar.innerHTML = '<canvas aria-hidden="true"></canvas><small>Radar</small>';
  root.appendChild(radar);
  const cv = radar.querySelector('canvas'), g2 = cv.getContext('2d');
  let rSize = 0;
  const sizeRadar = () => { const css = innerWidth <= 640 ? 92 : 124, dpr = Math.min(2, devicePixelRatio || 1); if (css * dpr === rSize) return; rSize = css * dpr; cv.width = cv.height = Math.round(css * dpr); cv.style.width = cv.style.height = css + 'px'; };

  // ── the blue ship to set down on ──
  let goal = null;
  function setGoal(opts) {
    if (goal) { scene.remove(goal.group); goal.geo.dispose(); goal.edges.dispose(); goal.glass.dispose(); goal.wire.dispose(); goal = null; }
    if (!opts) return null;
    const { cfg, landing, toward = null } = opts;
    // (its ramps are on its sides, the Medic's: the side to port toward the pods, as the flying's pad has it)
    const [fx, fz] = padNose({ landing }, toward);
    const geo = modelShape(cfg.model, { body: 0xffffff }, 1), edges = new THREE.EdgesGeometry(geo);
    const glass = bent(new THREE.MeshBasicMaterial({ color: HOLO.goal, transparent: true, opacity: GOAL.glass, depthWrite: false, toneMapped: false, fog: false }), U);
    const wire = bent(new THREE.LineBasicMaterial({ color: HOLO.line, transparent: true, opacity: GOAL.edges, toneMapped: false, fog: false }), U);
    const group = new THREE.Group(); group.name = 'the way: the blue ship to set down on';
    group.add(new THREE.Mesh(geo, glass), new THREE.LineSegments(edges, wire));
    for (const o of group.children) { o.frustumCulled = false; o.renderOrder = 5; }
    // (the small space's frame, nose toward -z, turned to the flight model's (nose along +x), then as it is to stand)
    const q = new THREE.Quaternion(...facing([fx, 0, fz])).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2));
    group.position.set(landing.x, landing.y + 0.03, landing.z); group.quaternion.copy(q);
    group.visible = lit; scene.add(group);
    goal = { group, geo, edges, glass, wire, at: [landing.x, landing.y, landing.z], nose: [fx, fz], q: facing([fx, 0, fz]) };
    return goal;
  }

  const _p = new THREE.Vector3(), _c = new THREE.Vector3();
  let shown = { arrow: null, edge: false, dist: 0, dot: null };
  function update(camera, dt, { ahead = null } = {}) {
    if (closed) return;
    clock += dt;
    if (lit && rise < 1) rise = Math.min(1, rise + dt / BEAM.rise);
    if (!lit && rise > 0) rise = Math.max(0, rise - dt / 0.5);
    const e = 1 - Math.pow(1 - rise, 3);
    camera.updateMatrixWorld();
    const cam = camera.position, off = offsetTo([cam.x, cam.y, cam.z], [target.x, target.y, target.z]);
    // the beam: never thinner than a few pixels on the screen; softer close by
    const B = beam.material.uniforms;
    B.uRise.value = e; B.uTime.value = clock;
    B.uPx.value = 2 * Math.tan(camera.fov * Math.PI / 360) / Math.max(200, innerHeight) * BEAM.px;
    const k = Math.min(1, Math.max(0, (off.dist - BEAM.soft[0]) / (BEAM.soft[1] - BEAM.soft[0])));
    B.uOpacity.value = (BEAM.near + (1 - BEAM.near) * k) * Math.min(1, rise * 3);
    beam.visible = rise > 0;
    if (goal) goal.group.visible = rise > 0;
    // the radar: heading up, the ship's own (the camera's way across the ground when none is given)
    if (!ahead) { camera.getWorldDirection(_c); ahead = [_c.x, _c.z]; if (Math.hypot(ahead[0], ahead[1]) < 1e-4) { _c.set(0, 1, 0).applyQuaternion(camera.quaternion); ahead = [_c.x, _c.z]; } }
    const [right, fwd] = shipFrame(off.dx, off.dz, ahead), dot = lit ? radarDot(right, fwd, RADAR.range) : null;
    radar.hidden = !on; sizeRadar();
    // (in the corner under whatever strip the page has along its top)
    const box0 = bounds ? bounds() : { left: 0, top: 0, right: innerWidth, bottom: innerHeight }, rt = Math.round(box0.top + 8) + 'px';
    if (radar.style.top !== rt) radar.style.top = rt;
    if (on) g2.clearRect(0, 0, cv.width, cv.height);
    if (on) drawRadar(g2, cv.width / 2, cv.height / 2, cv.width / 2 - 2, { dot, colour: hex, clock, ring: RADAR.ring / RADAR.range });
    // the arrow: over the wreck when it is in sight, at the edge pointing round to it when not; not once there
    const box = { left: box0.left + ARROW.edge, top: box0.top + ARROW.edge, right: box0.right - ARROW.edge, bottom: box0.bottom - ARROW.edge };
    const there = off.dist < ARROW.there;
    if (!lit || there || rise < 0.5) { if (!way.hidden) way.hidden = true; shown = { arrow: null, edge: false, dist: off.dist, dot }; return; }
    // (the point over the wreck, a little above it, bent as the ground is)
    const d2 = off.dx * off.dx + off.dz * off.dz, y = target.y + 4 - d2 * U.uCurve.value;
    const behind = camera.getWorldDirection(_c).dot(_p.set(target.x - cam.x, y - cam.y, target.z - cam.z)) <= 0;
    _p.set(target.x, y, target.z).project(camera);
    const sx = (_p.x + 1) / 2 * innerWidth, sy = (1 - _p.y) / 2 * innerHeight;
    const words = `${label} · ${distWords(off.dist)}`;
    if (wayWords.textContent !== words) wayWords.textContent = words;
    way.setAttribute('aria-label', `${label}, ${distWords(off.dist)} away`);
    way.hidden = false;
    if (!behind && inBox(sx, sy - ARROW.over, box)) {
      // over it, pointing down at it, the words above
      way.classList.remove('is-edge'); wayArrow.style.transform = ''; way.style.flexDirection = '';
      const w = way.offsetWidth, h = way.offsetHeight;
      way.style.transform = `translate(${Math.round(sx - w / 2)}px, ${Math.round(sy - h - 6)}px)`;
      shown = { arrow: [sx, sy], edge: false, dist: off.dist, dot };
    } else {
      // at the edge, pointing out toward it (the arrow drawn pointing down: turned from there)
      const E = edgeSpot(sx, sy, box, behind);
      way.classList.add('is-edge');
      wayArrow.style.transform = `rotate(${(E.angle - Math.PI / 2).toFixed(3)}rad)`;
      // (the words on the side of the arrow toward the middle: the arrow outermost, at the edge)
      const c = Math.cos(E.angle), sn = Math.sin(E.angle);
      way.style.flexDirection = c > 0.38 ? 'row' : c < -0.38 ? 'row-reverse' : sn > 0 ? 'column' : 'column-reverse';
      const w = way.offsetWidth, h = way.offsetHeight;
      const ax = Math.min(Math.max(E.x - w / 2 - c * (w / 2 - 17), box0.left + 4), box0.right - w - 4), ay = Math.min(Math.max(E.y - h / 2 - sn * (h / 2 - 17), box0.top + 4), box0.bottom - h - 4);
      way.style.transform = `translate(${Math.round(ax)}px, ${Math.round(ay)}px)`;
      shown = { arrow: [E.x, E.y], edge: true, angle: E.angle, dist: off.dist, dot };
    }
  }

  return {
    get lit() { return lit; },
    light(v = true) { lit = !!v; if (lit) on = true; if (!lit) way.hidden = true; },
    // (the ship's sight up at all: the radar sweeping, before anything is found)
    show(v = true) { on = !!v; if (!on) { lit = false; way.hidden = true; radar.hidden = true; } },
    update, goal: setGoal, colour,
    get target() { return target; }, get goalAt() { return goal ? { at: goal.at, nose: goal.nose } : null },
    state: () => ({ lit, rise: +rise.toFixed(2), colour: colour.id, arrow: way.hidden ? null : { at: shown.arrow && shown.arrow.map(Math.round), edge: shown.edge, words: wayWords.textContent }, dist: Math.round(shown.dist), dot: shown.dot && { x: +shown.dot.x.toFixed(3), y: +shown.dot.y.toFixed(3), beyond: shown.dot.beyond }, beam: beam.visible, goal: !!(goal && goal.group.visible) }),
    dispose() { closed = true; scene.remove(beam); beam.geometry.dispose(); beam.material.dispose(); setGoal(null); way.remove(); radar.remove(); },
  };
}
