// THE RADIO TOWER, LIVE: what joins the radio desk's cards (src/jobs/antenna.js) to the antenna (kit/antenna.js). It
// stands at the very top of the station, on the control tower's roof (the game's maker, 2026-11-23: "at the very top of
// the station, over the control tower"; kit/antenna-plan.js ANTENNA.at and the roof's measure), 15 m over the control
// room the job is worked from.
//   - THE ANTENNA AS IT STANDS (standingAntenna): drawn with the station's outside (a part of it: hidden whenever the
//     outside is), as the crew member playing has it: the old dish on its pole until the new one is built; each step
//     built so far; once the radio tower is repaired, the whole new antenna, its red light at the very top lit.
//   - WHILE THE JOB IS UP: the view glides from the radio desk out through the corner window and up the tower's side to
//     its top (no dark screen: the game's maker, 2026-11-18, "as little of black screen, magically appear in the game
//     as possible"), and from out there, beside and a little over the roof (so neither the control room's ceiling nor
//     the roof's own edge is ever in front of the work), it follows the build: near and looking down for the footing,
//     the legs and the braces, back for the stacking and the cables, up for the dish and the sky. A right answer and
//     that step's parts go in: the faint plan of the 12 m mast; the pads go down one after another; the legs stand up;
//     the braces go in (the youngest tap each wobbly face, on the card or on the mast itself, as at the dock's bridge);
//     seven sections go up; the three arms reach out, the anchors and the six cables go on; the dish is
//     lifted to the top, tilted up and turned round (the old one goes down). Then THE TEST: switched on, the light at
//     the top blinks, the dish sweeps the sky and the mast holds; and the last card is the call. Answered, the dish
//     turns the last 5 degrees, its feed lights green, and the end card has the call, line by line (text only: no
//     voice): a station in distress. The crew member's radio tower is repaired (src/jobs/antenna.js antennaRepaired).
// The panel's `live` (src/jobs/panel.js): now() (the step being asked), ready(), right(q, coin), wrong(q, coin),
// head(o), play(o, ui), over(), update(dt), aim(camera, dt), close(); state() for the rigs.
import * as THREE from 'three';
import { ANTENNA, TOP, parts, DISH_FOOT, dishPose, cableFrom, armWays, FACES as KFACES } from '../../kit/antenna.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { meshesOf } from '../../kit/dockbridge.js';
import { makeMaterials } from '../../kit/materials.js';
import { DIR as SKY } from '../../world/sky.js';
import { STEPS, CALL, SIGNAL, antennaOf, antennaSeen, stepBuilt, buildAgain, faceSvg, FACES } from './antenna.js';

const CSS = new URL('./antenna.css', import.meta.url).href;
function ensureCss() {
  if (typeof document === 'undefined' || document.querySelector('link[data-ant]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; l.dataset.ant = '1'; document.head.appendChild(l);
}
if (typeof document !== 'undefined') ensureCss();

// how long things take (seconds)
export const TIMES = { intro: 3.2, ghost: 0.9, pad: 0.32, legs: 0.8, brace: 0.16, pop: 0.3, lock: 0.6, section: 0.34, arm: 0.4, anchor: 0.22, cable: 0.32, lift: 1.4, tilt: 0.7, turn: 1.1, oldDown: 1.0, test: 3.6, last: 0.8, jolt: 0.6 };
export const WOBBLE = { amp: 0.07, hz: 1.2, jolt: 0.08 };
const LINE_GAP = 0.55;   // (seconds between the call's lines coming in on the end card)
// THE VIEWS (metres, in the antenna's frame: x east, y up from the tower's roof, z south): the camera stands `from` the
// point it looks at, `look`, and turns so that point lands at the screen point `on` (-1..1 across, -1..1 up): left of
// the panel on a wide screen, in the band above it on a phone, whatever the screen's shape; `far` on a phone (the band
// is short, so it stands further back). All from out in the open beside the tower's top, to the south-west of it and
// over the roof's own height (the dish turns round to face that way, and nothing of the tower is ever between): `low`
// looks down onto the roof for the footing, the legs and the braces; `whole` stands back for the stacking, the arms
// and the cables; `top` and `sky` are up at the dish; `end` is the whole of it on the tower, the control room's windows
// below.
export const VIEW = {
  low: { look: [0, 0.8, 0], from: [-3.2, 4.4, 6.4], fov: 50 },
  whole: { look: [0, 5.6, 0], from: [-7, 3.4, 20], fov: 52 },
  top: { look: [0, 12.6, 0], from: [-2.6, 1.6, 6.4], fov: 52 },
  sky: { look: [0, 12.9, 0], from: [-3.8, -1.2, 7.8], fov: 54 },
  end: { look: [0, -2, 0], from: [-13, 6, 37], fov: 55 },
  on: { wide: [-0.36, 0], tall: [0, 0.6] }, far: 1.4,
};
// which view each step is asked from (the step being asked: 0 the old antenna ... 7 the call)
const VIEW_OF = ['whole', 'low', 'low', 'low', 'whole', 'whole', 'top', 'sky'];
// THE GLIDE OUT goes through the control room's south-west corner window (kit/tower.js, its cut corner's middle at
// about (34, 31) in the station's frame), from a point just inside the pane to one outside it, then out and up past the
// control room's roof (`clear`: well out from the roof's edge, a little over it) to the view at the tower's top
export const GLIDE = { inside: new THREE.Vector3(34.6, 46.1, 30.4), outside: new THREE.Vector3(32.6, 45.6, 32.4), clear: new THREE.Vector3(28.5, 53, 37.5) };
// the light outside (the kit's saved-light units, as the dock's bridge has it): the sun and the planet's glow
const SUN = { i: 2.2, c: [1, 0.95, 0.88] }, SHINE = { i: 0.45, c: [0.55, 0.75, 1.0] }, FILL = { i: 0.12, c: [0.6, 0.7, 0.85] };
const ease = (t) => t * t * (3 - 2 * t);
const back = (t) => { const s = 1.6; t -= 1; return t * t * ((s + 1) * t + s) + 1; };
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const BEACON = [3.2, 0.25, 0.18], FEED = [0.6, 3.2, 1.0];
// THE LIGHT AT THE VERY TOP IS SEEN FROM FAR: a small soft glow round it that keeps its size on the screen however far
// off it is looked at from (HALO: its size, as a part of the view's height at a 60 degree lens: about 8 dots of 800), so
// that the station's tip still shows its red light to a ship far out, as the old pole's red ball did. Near, it is
// inside the light's own ball.
const HALO = 0.011;
let HALO_MAP = null;
function haloMap() {
  if (HALO_MAP) return HALO_MAP;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,0.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 32, 32);
  return (HALO_MAP = new THREE.CanvasTexture(c));
}
// the top's lights: their colour (dark, dim between blinks, or lit), and the far glow with it
function lightTop(M, c) { M.beaconMat.color.setRGB(c[0], c[1], c[2]); const k = clamp01((c[0] - 0.3) / 2); M.halo.material.opacity = k; M.halo.visible = k > 0.01; }
const DARK = [0.12, 0.03, 0.03], DIM = [0.3, 0.03, 0.02];

function lightOf() {
  const sun = SKY.sun.clone().normalize(), shine = SKY.planet.clone().normalize();
  return (p, n) => {
    const out = [0, 0, 0], add = (k, c) => { out[0] += k * c[0]; out[1] += k * c[1]; out[2] += k * c[2]; };
    add(Math.max(0, n.dot(sun)) * SUN.i, SUN.c);
    add((0.35 + 0.65 * Math.max(0, n.dot(shine))) * SHINE.i, SHINE.c);
    add(FILL.i * (0.6 + 0.4 * n.y), FILL.c);
    return out;
  };
}
// a piece's meshes, lit where it stands (`m`: its own frame into the antenna's, for the dish's parts)
function lit(piece, mats, light, m = null) {
  const L = m ? (p, n) => light(p.clone().applyMatrix4(m), n.clone().transformDirection(m)) : light;
  return meshesOf(piece, mats, L);
}
const groupOf = (name, list) => { const g = new THREE.Group(); g.name = name; for (const x of list) g.add(x); return g; };

// ── the meshes: made once, with the jobs (kept for the page) ─────────────────────────────────────────────────────
let MADE = null;
function make(W) {
  const t0 = performance.now(), mats = makeMaterials();
  for (const m of Object.values(mats)) m.fog = false;
  const light = lightOf(), P = parts();
  const root = new THREE.Group(); root.name = 'antenna';
  const old = groupOf('antenna: the old one', lit(P.old, mats, light));
  const planMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.85, 1.4), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false });
  const ghost = new THREE.Mesh(P.ghost, planMat); ghost.name = 'antenna: the plan';
  const pads = P.pads.map((p, i) => groupOf('antenna: pad ' + (i + 1), lit(p, mats, light)));
  // the first section: its legs and struts, its braces, each face's outline and what a tap finds (sheared as one when
  // it wobbles)
  const sec0 = new THREE.Group(); sec0.name = 'antenna: the first section'; sec0.matrixAutoUpdate = false;
  const legs = groupOf('antenna: the legs', lit(P.legs, mats, light)); legs.matrixAutoUpdate = false; sec0.add(legs);
  const braces = P.braces.map((b, f) => { const g = groupOf('antenna: brace ' + f, lit(b, mats, light)); g.userData.mid = new THREE.Vector3(...P.faces[f].mid); sec0.add(g); return g; });
  const outlineMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.15, 0.25), transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, fog: false });
  const outlines = P.faces.map((f) => { const m = new THREE.Mesh(f.outline, outlineMat); m.renderOrder = 3; sec0.add(m); return m; });
  const hitMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const targets = P.faces.map((f, k) => { const m = new THREE.Mesh(f.target, hitMat); m.visible = false; m.userData.face = k; root.add(m); return m; });
  const flashes = P.faces.map((f) => { const m = new THREE.Mesh(f.target, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.2, 2.6), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); m.renderOrder = 4; sec0.add(m); return m; });
  const sections = P.sections.map((s, k) => { const g = groupOf('antenna: section ' + (k + 2), lit(s, mats, light)); g.matrixAutoUpdate = false; g.userData.y0 = (k + 1) * ANTENNA.sec; return g; });
  // (each arm grows out from its inner end on the roof; each cable from where it leaves the mast)
  const ways = armWays();
  const arms = P.arms.map((a, k) => { const g = groupOf('antenna: arm ' + (k + 1), lit(a, mats, light)); g.matrixAutoUpdate = false; g.userData.at = new THREE.Vector3(ways[k][0] * ANTENNA.arm.from[k], ANTENNA.arm.y, ways[k][1] * ANTENNA.arm.from[k]); return g; });
  const anchors = P.anchors.map((a, k) => groupOf('antenna: anchor ' + (k + 1), lit(a, mats, light)));
  const cables = P.cables.map((c, k) => { const g = groupOf('antenna: cable ' + (k + 1), lit(c, mats, light)); g.matrixAutoUpdate = false; g.userData.at = new THREE.Vector3(...cableFrom(ANTENNA.bearings[k % 3], ANTENNA.holds[Math.floor(k / 3)])); return g; });
  const mount = groupOf('antenna: the dish mount', lit(P.mount, mats, light));
  const beaconMat = mats.glow.clone(); beaconMat.color.setRGB(0.12, 0.03, 0.03);
  const beacon = groupOf('antenna: the light at the top', meshesOf(P.beacon, { glow: beaconMat }, light));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloMap(), color: new THREE.Color(2.0, 0.14, 0.09), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false, toneMapped: false, fog: false }));
  halo.name = 'antenna: the far glow of the light at the very top'; halo.scale.setScalar(HALO); halo.position.set(ANTENNA.tip.at[0], ANTENNA.tip.h - ANTENNA.tip.r, ANTENNA.tip.at[1]); halo.visible = false; beacon.add(halo);
  const tip = groupOf('antenna: the rod of the light at the very top', lit(P.tip, mats, light));
  // the dish as it stands when aimed (its parts lit there): the yoke turns about y on the turntable, the bowl tilts on it
  const pose = dishPose(), foot = new THREE.Vector3(...DISH_FOOT());
  const yokeM = new THREE.Matrix4().makeRotationY(pose.yaw).setPosition(foot);
  const bowlM = yokeM.clone().multiply(new THREE.Matrix4().makeTranslation(0, P.dish.pivot, 0)).multiply(new THREE.Matrix4().makeRotationX(pose.pitch));
  const yoke = groupOf('antenna: the dish', lit(P.dish.yoke, mats, light, yokeM)); yoke.position.copy(foot);
  const bowl = groupOf('antenna: the bowl', lit(P.dish.bowl, mats, light, bowlM)); bowl.position.set(0, P.dish.pivot, 0); yoke.add(bowl);
  const feedMat = mats.glow.clone(); feedMat.color.setRGB(0.05, 0.12, 0.06);
  bowl.add(...meshesOf(P.dish.feed, { glow: feedMat }, light));
  root.add(old, ghost, ...pads, sec0, ...sections, ...arms, ...anchors, ...cables, mount, beacon, tip, yoke);
  MADE = { root, mats, old, ghost, planMat, pads, sec0, legs, braces, outlines, outlineMat, targets, flashes, sections, arms, anchors, cables, mount, beacon, beaconMat, halo, tip, yoke, bowl, feedMat, ms: Math.round(performance.now() - t0) };
  return MADE;
}
// the antenna's frame in the world: on the control tower's roof where it stands, turned as the station is
const FRAME = new THREE.Matrix4().makeTranslation(...ANTENNA.at);
const toWorld = (v) => v.applyMatrix4(FRAME);

// ── the parts as a crew member's antenna has them: `built` steps (0..8) ─────────────────────────────────────────────
function showBuilt(M, built, { on = built >= STEPS.length } = {}) {
  const has = (k) => built > k;
  M.old.visible = !has(6); M.old.scale.set(1, 1, 1);
  M.ghost.visible = has(0) && !has(4); M.planMat.opacity = 0.32;
  M.pads.forEach((p) => { p.visible = has(1); p.position.set(0, 0, 0); });
  M.sec0.visible = has(2); M.legs.visible = has(2); M.legs.matrix.identity(); M.sec0.matrix.identity(); M.sec0.matrixWorldNeedsUpdate = true;
  M.braces.forEach((b) => { b.visible = has(3); b.scale.setScalar(1); b.position.set(0, 0, 0); });
  M.outlines.forEach((o) => { o.visible = false; }); M.flashes.forEach((f) => { f.visible = false; });
  M.sections.forEach((s) => { s.visible = has(4); s.matrix.identity(); s.matrixWorldNeedsUpdate = true; });
  M.arms.forEach((a) => { a.visible = has(5); a.matrix.identity(); a.matrixWorldNeedsUpdate = true; });
  M.anchors.forEach((a) => { a.visible = has(5); a.position.set(0, 0, 0); });
  M.cables.forEach((c) => { c.visible = has(5); c.matrix.identity(); c.matrixWorldNeedsUpdate = true; });
  M.mount.visible = has(6); M.yoke.visible = has(6);
  aimDish(M, ANTENNA.dish.turn + (on ? SIGNAL.best - SIGNAL.at : 0), ANTENNA.dish.tilt);
  M.yoke.position.set(...DISH_FOOT());
  M.beacon.visible = M.tip.visible = has(4); lightTop(M, on ? BEACON : DARK);
  M.feedMat.color.setRGB(...(on ? FEED : [0.05, 0.12, 0.06]));
}
function aimDish(M, turn, tilt) { const p = dishPose(turn, tilt); M.yoke.rotation.set(0, p.yaw, 0); M.bowl.rotation.set(p.pitch, 0, 0); }
// (the dish's own lighting was worked out with it aimed at 135 degrees: a few degrees off reads the same)

// THE ANTENNA AS IT STANDS, with the station's outside: standingAntenna(W) -> { sync(crew), update(dt), held(on) }
export function standingAntenna(W) {
  const M = MADE || make(W);
  const parent = W.scene.getObjectByName('outside') || W.scene;
  parent.updateMatrixWorld(true);
  M.root.matrix.copy(parent.matrixWorld.clone().invert().multiply(FRAME)); M.root.matrixAutoUpdate = false; M.root.matrixWorldNeedsUpdate = true;
  if (M.root.parent !== parent) parent.add(M.root);
  let crewNow = null, key = '', hold = false, clock = 0;
  // (the whole antenna standing still, repaired: its painted parts drawn as one mesh, made the first time it is wanted;
  // its lights stay their own: the red ones at the top blinking, the far glow of the one at the very top, the dish's
  // feed. The job moves the parts themselves)
  const solidParts = () => { const list = []; M.root.traverse((o) => { if (o.isMesh && o.material === M.mats.solid && o !== M.merged) list.push(o); }); return list; };
  function whole(on) {
    if (on && !M.merged) {
      showBuilt(M, STEPS.length);
      M.root.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(M.root.matrixWorld).invert(), list = [];
      for (const o of solidParts()) { let shown = o.visible; for (let p = o.parent; p && p !== M.root; p = p.parent) if (!p.visible) shown = false; if (shown) list.push(o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld))); }
      const g = mergeGeometries(list); for (const x of list) x.dispose();
      M.merged = new THREE.Mesh(g, M.mats.solid); M.merged.name = 'antenna: as it stands'; M.root.add(M.merged);
    }
    if (M.merged) M.merged.visible = on;
    for (const o of solidParts()) o.visible = !on;
  }
  return {
    get made() { return M.ms; },
    // (the crew member playing: their antenna as they have it; once repaired, the whole new one, whatever is being
    // built again)
    sync(crew, force = false) {
      if (hold) return;
      const a = antennaSeen(crew), k = `${crew ? crew.id || crew.name : ''}:${a.built}:${a.repaired}`;
      if (!force && crew === crewNow && k === key) return;
      crewNow = crew; key = k;
      whole(false);
      showBuilt(M, a.repaired ? STEPS.length : a.built);
      if (a.repaired) whole(true);
    },
    // (its light at the top blinks once it is switched on)
    update(dt) { if (hold || !M.root.visible) return; clock += dt; if (key.endsWith(':true')) lightTop(M, (clock % 1.6) < 0.25 ? BEACON : DIM); },
    // (while the job is up it moves the parts itself)
    held(on) { hold = !!on; if (on) whole(false); else key = ''; },
    // (how many meshes it draws now, for the rigs)
    draws: () => { let n = 0; M.root.traverse((o) => { if ((o.isMesh || o.isSprite) && o.visible) { let shown = true; for (let p = o.parent; p && p !== M.root.parent; p = p.parent) if (!p.visible) shown = false; if (shown) n++; } }); return n; },
    M,
  };
}

// ── THE JOB ─────────────────────────────────────────────────────────────────────────────────────────────────────
// crew: the crew member building (their antenna is kept with them); save(): saves them; standing: standingAntenna(W)
export function antennaLink({ W, job, crew = null, save = () => {}, standing = null } = {}) {
  ensureCss();
  const S0 = standing || standingAntenna(W), M = S0.M;
  S0.held(true);
  const dustWas = W.dust ? W.dust.visible : false;
  // (while the view is out at the tower's top, only the control room is drawn of the station's rooms: the ones under the
  // roofs could not be seen, and the hangars far below cost as much again)
  const roomsWas = W.rooms;
  let out = false;
  W.rooms = (z, drawn) => { const d = roomsWas ? roomsWas(z, drawn) : drawn; return out ? z.id === 'tower' : d; };

  let cur = 0, anim = null, finished = false, closed = false, clock = 0, order = null, ui = null, queue = [], braced = new Set(), pops = new Map(), fl = new Map(), jolt = 0, loose = 1, tested = false, heard = 0;
  const a0 = () => (crew ? antennaOf(crew) : { built: cur, repaired: false });
  // the antenna as the crew member has it at the job's opening
  function reset() {
    // (a repaired one built to its end: the end card comes first, "Build it again" or "Done")
    const a = a0();
    cur = a.built; finished = cur >= STEPS.length; queue = []; braced.clear(); pops.clear(); fl.clear(); jolt = 0; tested = finished; heard = finished ? 1 : 0;
    showBuilt(M, cur, { on: finished });
    if (cur > 3) for (let f = 0; f < FACES; f++) braced.add(f);
    loose = cur === 3 ? 1 : 0;
    // (the dish on and the call not yet heard: the test plays first)
    if (cur === 7) test();
  }
  // ── the parts going in, one after another (a queue of timed steps: each { t: its length, run(k 0..1), done() }) ──
  const later = (secs, run, done = null) => queue.push({ t: secs, at: 0, run, done });
  function build(step) {
    if (step === 0) { M.ghost.visible = true; later(TIMES.ghost, (k) => { M.planMat.opacity = 0.32 * ease(k) + 0.5 * Math.sin(Math.PI * k); }); }
    if (step === 1) M.pads.forEach((p) => { later(TIMES.pad, (k) => { p.visible = true; p.position.y = 1.4 * (1 - back(k)); }); });
    if (step === 2) { M.sec0.visible = true; M.legs.visible = true; later(TIMES.legs, (k) => { M.legs.matrix.makeScale(1, Math.max(0.02, back(k)), 1); M.legs.matrixWorldNeedsUpdate = true; }, () => { M.legs.matrix.identity(); loose = 1; }); }
    if (step === 3) {
      // (the braces still to go in, one after another, the camera's side first; then the section locks: a flash)
      for (const f of [2, 3, 1, 0]) if (!braced.has(f)) later(TIMES.brace, () => {}, () => brace(f, false));
      later(TIMES.lock, (k) => { for (const m of M.flashes) { m.visible = k < 1; m.material.opacity = 0.6 * Math.sin(Math.PI * k); } }, () => { for (const m of M.flashes) m.visible = false; });
    }
    if (step === 4) {
      M.sections.forEach((s) => { later(TIMES.section, (k) => { s.visible = true; const y0 = s.userData.y0; s.matrix.makeTranslation(0, y0, 0).multiply(new THREE.Matrix4().makeScale(1, Math.max(0.02, back(k)), 1)).multiply(new THREE.Matrix4().makeTranslation(0, -y0, 0)); s.matrixWorldNeedsUpdate = true; }); });
      later(0.5, (k) => { M.planMat.opacity = 0.32 * (1 - k); }, () => { M.ghost.visible = false; M.beacon.visible = M.tip.visible = true; });
    }
    if (step === 5) {
      // (the three arms reach out past the roof's edge, an anchor comes down on each one's end, the cables pull out)
      const grow = (o, s) => { const A = o.userData.at; o.matrix.makeTranslation(A.x, A.y, A.z).multiply(new THREE.Matrix4().makeScale(s, s, s)).multiply(new THREE.Matrix4().makeTranslation(-A.x, -A.y, -A.z)); o.matrixWorldNeedsUpdate = true; };
      M.arms.forEach((a) => later(TIMES.arm, (k) => { a.visible = true; grow(a, Math.max(0.01, ease(k))); }));
      M.anchors.forEach((a) => later(TIMES.anchor, (k) => { a.visible = true; a.position.y = 0.9 * (1 - back(k)); }));
      M.cables.forEach((c) => later(TIMES.cable, (k) => { c.visible = true; const A = c.userData.at, s = Math.max(0.01, ease(k)); c.matrix.makeTranslation(A.x, A.y, A.z).multiply(new THREE.Matrix4().makeScale(s, s, s)).multiply(new THREE.Matrix4().makeTranslation(-A.x, -A.y, -A.z)); c.matrixWorldNeedsUpdate = true; }));
    }
    if (step === 6) {
      // lifted from the tower's roof to the mast's top, then tilted up and turned round from the bow; the old one goes
      // down meanwhile
      M.mount.visible = true; M.yoke.visible = true; aimDish(M, 0, 0);
      const foot = DISH_FOOT(), y0 = 0.4;
      later(TIMES.lift, (k) => { M.yoke.position.set(foot[0], y0 + (foot[1] - y0) * ease(k), foot[2]); M.old.scale.set(1, Math.max(0.01, 1 - ease(k)), 1); }, () => { M.old.visible = false; });
      later(TIMES.tilt, (k) => aimDish(M, 0, ANTENNA.dish.tilt * ease(k)));
      later(TIMES.turn, (k) => aimDish(M, ANTENNA.dish.turn * ease(k), ANTENNA.dish.tilt), () => test());
    }
    if (step === 7) {
      // heard: the last 5 degrees, the feed lit green
      later(TIMES.last, (k) => { aimDish(M, SIGNAL.at + (SIGNAL.best - SIGNAL.at) * ease(k), ANTENNA.dish.tilt); M.feedMat.color.setRGB(...FEED.map((c) => c * (0.2 + 0.8 * k))); }, () => { heard = 1; });
    }
  }
  // THE TEST: switched on, the light at the top blinks, the dish sweeps the sky either side of where it is aimed, the
  // mast holds (a small shudder as the station's thrusters fire, braced: it does not sway), and it hears something
  function test() {
    later(0.001, () => { anim = 7; });
    later(TIMES.test, (k) => {
      const sweep = Math.sin(k * Math.PI * 3) * 28 * Math.sin(Math.PI * k);
      aimDish(M, ANTENNA.dish.turn + sweep, ANTENNA.dish.tilt);
      lightTop(M, (k * 6) % 1 < 0.3 ? BEACON : DIM);
      if (k > 0.45 && k < 0.6) jolt = Math.max(jolt, 0.35);
      M.feedMat.color.setRGB(...FEED.map((c) => c * (k > 0.85 ? 0.25 : 0.05)));
    }, () => { tested = true; aimDish(M, SIGNAL.at, ANTENNA.dish.tilt); });
  }

  // ── the faces a young player braces ──────────────────────────────────────────────────────────────────────────
  const isBrace = () => !!(order && order.play === 'brace');
  function brace(f, byHand = true) {
    if (braced.has(f)) return false;
    if (byHand && (!isBrace() || order.played || cur !== 3 || queue.length)) return false;
    braced.add(f); pops.set(f, 0); fl.set(f, 0); M.braces[f].visible = true;
    const done = braced.size >= FACES;
    if (ui && byHand) {
      const b = ui.answers.querySelector(`.dkb-sq[data-k="${f}"]`); if (b) { b.classList.add('is-braced'); b.setAttribute('aria-pressed', 'true'); b.disabled = true; }
      markNext(ui.answers);
      const c = ui.answers.querySelector('.dkb-count'); if (c) c.textContent = done ? 'All braced!' : `${braced.size} of ${FACES} braced`;
    }
    if (done && byHand) { order.played = true; const u = ui, o = order; setTimeout(() => { if (!closed && u && order === o) u.pick(0); }, 380); }
    return true;
  }
  function markNext(root) { let first = true; root.querySelectorAll('.dkb-sq').forEach((b) => { const next = first && !b.classList.contains('is-braced'); if (next) first = false; b.classList.toggle('is-next', next); }); }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function onTap(e) {
    if (closed || !isBrace() || cur !== 3) return;
    const r = W.renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    M.root.updateMatrixWorld(true);
    ray.setFromCamera(ndc, W.camera);
    const hits = ray.intersectObjects(M.targets.filter((t) => !braced.has(t.userData.face)), false);
    if (hits.length && brace(hits[0].object.userData.face)) e.preventDefault();
  }
  W.renderer.domElement.addEventListener('pointerdown', onTap);
  function onKey(e) { if (closed || !isBrace() || !/^[1-4]$/.test(e.key) || document.querySelector('.pnl, .bml:not(.is-out)')) return; brace(+e.key - 1); }
  addEventListener('keydown', onKey);

  // ── the panel's live ─────────────────────────────────────────────────────────────────────────────────────────
  const now = () => ({ step: Math.min(cur, STEPS.length - 1) });
  const WAIT = ['The plan goes up...', 'The pads go down...', 'The legs stand up...', 'The braces go in...', 'The sections go up...', 'The arms and the cables go on...', 'The dish goes up...', 'Listening...'];
  function ready() {
    if (finished || !queue.length) return true;
    return { ok: false, why: cur === 7 && !tested ? 'Switching on: the dish sweeps the sky...' : WAIT[Math.max(0, cur - 1)] || 'Building...' };
  }
  function right() {
    if (finished) return;
    const step = cur;
    anim = step;   // (the view stays on the step going in until its parts are in)
    // (kept with the crew member at once: the step stays built however the visit ends)
    if (crew) { stepBuilt(crew); save(); }
    build(step);
    cur = step + 1;
    if (cur >= STEPS.length) finished = true;
    if (cur === 3) loose = 1;
  }
  function wrong() { if (cur <= 3) jolt = 1; }
  const ICON = '<svg class="ant-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 9 L6 19 M10 9 L14 19 M7.3 15.5 H12.7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M5.5 6.5 a6 6 0 0 1 9 0 M3.2 4.2 a9.2 9.2 0 0 1 13.6 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="10" cy="9" r="1.6" fill="currentColor"/></svg>';
  function head(o, end = false) {
    const n = Math.min(cur, STEPS.length - 1);
    const dots = STEPS.map((s, i) => `<i class="${i < cur || end ? 'is-built' : i === cur ? 'is-now' : ''}"></i>`).join('');
    const said = end ? 'All 8 steps built' : `Step ${n + 1} of ${STEPS.length}: ${STEPS[n].name}`;
    return `<header class="pnj-cardtop is-plan ant-top">${ICON}<b>${end ? 'The radio tower' : STEPS[n].name}</b><small class="dkb-rings" role="img" aria-label="${said}" title="${said}">${dots}</small></header>`;
  }
  // the faces to tap, in place of the answers (the order's one coin is "every face braced")
  function play(o, u) {
    order = o; ui = u;
    if (!o || o.play !== 'brace') return false;
    const has = (k) => braced.has(k);
    const strip = document.createElement('div');
    strip.className = 'dkb-strip ant-faces'; strip.setAttribute('role', 'group'); strip.setAttribute('aria-label', 'The wobbly faces of the first section');
    strip.innerHTML = `<div class="dkb-sqs">${Array.from({ length: FACES }, (x, k) => `<button type="button" class="dkb-sq${has(k) ? ' is-braced' : ''}" data-k="${k}" aria-label="Brace face ${k + 1}" aria-pressed="${has(k)}"${has(k) ? ' disabled' : ''}>${faceSvg(k)}</button>`).join('')}</div>`
      + `<p class="dkb-count">${braced.size} of ${FACES} braced</p>`;
    u.answers.innerHTML = ''; u.answers.appendChild(strip);
    strip.querySelectorAll('.dkb-sq').forEach((b) => b.addEventListener('click', () => brace(+b.dataset.k)));
    markNext(strip);
    return true;
  }
  // the end: the call, line by line, and what it is. "Build it again" starts from the first step (the radio tower
  // stays repaired); "Done"
  function over() {
    if (!finished) return null;
    const bars = Array.from({ length: SIGNAL.bars }, (x, i) => `<i class="${i < SIGNAL.clear ? 'is-on' : ''}"></i>`).join('');
    return {
      html: `${head(null, true)}
        <div class="ant-call" role="group" aria-label="The radio">
          <div class="ant-sig"><b>SIGNAL</b><span class="ant-bars" aria-label="${SIGNAL.clear} bars of ${SIGNAL.bars}">${bars}</span><small>${SIGNAL.best}°</small></div>
          <p class="ant-lines">${CALL.map((l, i) => `<span style="--d:${(0.4 + i * LINE_GAP).toFixed(2)}s">${l}</span>`).join(' ')}</p>
        </div>
        <p class="pnj-story ant-end" style="--d:${(0.6 + CALL.length * LINE_GAP).toFixed(2)}s"><b>A station in distress!</b></p>
        <p class="pnj-story ant-end2" style="--d:${(1.0 + CALL.length * LINE_GAP).toFixed(2)}s">The call comes from ${SIGNAL.best}°, far beyond the planet. Captain Vega's next exploring run can follow it.</p>`,
      buttons: [{ label: 'Build it again', again: () => { if (crew) { buildAgain(crew); save(); } reset(); intro = 0; } }, { label: 'Done' }],
    };
  }

  // ── each frame ───────────────────────────────────────────────────────────────────────────────────────────────
  const _sh = new THREE.Matrix4();
  function update(dt) {
    if (closed) return;
    clock += dt;
    // the queue: the first step running, the next after it
    let left = dt;
    while (queue.length && left > 0) {
      const q = queue[0], use = Math.min(left, q.t - q.at); q.at += use; left -= use;
      q.run(clamp01(q.at / q.t));
      if (q.at >= q.t - 1e-6) { queue.shift(); if (q.done) q.done(); } else break;
    }
    // the braces popping in
    M.braces.forEach((b, f) => {
      if (!pops.has(f)) return;
      const t = pops.get(f) + dt; pops.set(f, t);
      const k = t >= TIMES.pop ? 1 : back(clamp01(t / TIMES.pop)), mid = b.userData.mid;
      b.scale.setScalar(Math.max(0.001, k)); b.position.copy(mid).multiplyScalar(1 - k);
      if (t >= TIMES.pop) { pops.delete(f); b.scale.setScalar(1); b.position.set(0, 0, 0); }
    });
    // a face just braced flashes
    M.flashes.forEach((m, f) => { const t = fl.get(f); if (t == null) return; const u = t + dt; fl.set(f, u); m.visible = u < 0.55; m.material.opacity = 0.75 * Math.max(0, 1 - u / 0.55); if (u >= 0.55) fl.delete(f); });
    // the faces still to brace marked (a young player's), pulsing
    M.outlines.forEach((o, f) => { o.visible = cur === 3 && isBrace() && !braced.has(f) && !queue.length; });
    M.outlineMat.opacity = 0.55 + 0.4 * Math.sin(clock * 5);
    // the wobble of the first section until it is braced (less as each face is), a jolt for a wrong answer; braced, the
    // whole mast's shudder at the test (it holds)
    const goal = cur === 3 ? 1 - braced.size / FACES : 0;
    loose += (goal - loose) * (1 - Math.exp(-6 * dt));
    jolt = Math.max(0, jolt - dt / TIMES.jolt);
    const k = WOBBLE.amp * loose * Math.sin(clock * WOBBLE.hz * 2 * Math.PI) + WOBBLE.jolt * jolt * Math.sin(clock * 21) * (cur <= 3 ? 1 : 0.25);
    _sh.set(1, k, 0, 0, 0, 1, 0, 0, 0, k * 0.4, 1, 0, 0, 0, 0, 1);
    M.sec0.matrix.copy(_sh); M.sec0.matrixWorldNeedsUpdate = true;
    // (the call heard: the light at the top blinks on)
    if (heard || finished) lightTop(M, (clock % 1.6) < 0.25 ? BEACON : DIM);
  }

  // ── the camera: out of the window and up to the tower's top ─────────────────────────────────────────────────────
  const want = new THREE.Vector3(), lookAt = new THREE.Vector3(), probe = new THREE.PerspectiveCamera();
  const camPos = new THREE.Vector3(), camQ = new THREE.Quaternion(), from0 = new THREE.Vector3(), q0 = new THREE.Quaternion();
  let fresh = true, forced = null, intro = TIMES.intro, introT = 0, fov0 = 60, viewNow = 'whole';
  // (the probe turned to look at the view's point from a place, that point at the screen point `on`)
  function lookFrom(at, V, tall, aspect) {
    const on = VIEW.on[tall ? 'tall' : 'wide'], tv = Math.tan(V.fov * Math.PI / 360), th = tv * aspect;
    probe.position.copy(at); probe.up.set(0, 1, 0); probe.lookAt(lookAt);
    probe.rotateY(Math.atan(on[0] * th)); probe.rotateX(-Math.atan(on[1] * tv));
  }
  function poseFor(V, tall, aspect) {
    const k = tall ? VIEW.far : 1;
    toWorld(lookAt.set(...V.look));
    toWorld(want.set(V.look[0] + V.from[0] * k, V.look[1] + V.from[1] * k, V.look[2] + V.from[2] * k));
    lookFrom(want, V, tall, aspect);
  }
  function aim(camera, dt = 1 / 60) {
    const tall = innerHeight > innerWidth * 1.05 || innerWidth <= 640;
    const end = finished && !queue.length;
    viewNow = forced || (end ? 'end' : VIEW_OF[Math.min(queue.length && anim != null ? anim : cur, STEPS.length - 1)]);
    const V = VIEW[viewNow];
    poseFor(V, tall, camera.aspect || innerWidth / innerHeight);
    out = true;
    if (fresh) {
      // (the glide out: from the player's own view at the desk, out through the corner window, out past the control
      // room's roof and up the tower's side to its top; the lens eased from the walking camera's to the view's)
      from0.copy(camera.position); q0.copy(camera.quaternion); fov0 = camera.fov; fresh = false; introT = 0;
      if (intro <= 0) { camPos.copy(want); camQ.copy(probe.quaternion); }
    }
    if (intro > 0) {
      introT += dt; const t = clamp01(introT / intro), e = ease(t);
      // (a curve from the desk, through the control room's south-west corner window (GLIDE: a point just inside its
      // pane and one outside it), out clear of the roof over it, and up to the view, at an even speed along it)
      const curve = new THREE.CatmullRomCurve3([from0.clone(), GLIDE.inside.clone(), GLIDE.outside.clone(), GLIDE.clear.clone(), want.clone()], false, 'centripetal');
      curve.getPointAt(e, camPos);
      // (turned toward the work from wherever it is on the way: out of the window it looks up the tower's side at its
      // top, so the place it is going to is in sight the whole way up, and it arrives turned as the view is)
      lookFrom(camPos, V, tall, camera.aspect || innerWidth / innerHeight);
      camQ.copy(q0).slerp(probe.quaternion, ease(clamp01((t - 0.08) / 0.6)));
      camera.fov = fov0 + (V.fov - fov0) * e; camera.updateProjectionMatrix();
      // (the station's rooms drawn as ever while the camera is still in the control room)
      const z = W.room('tower'); out = !(z && z.box.containsPoint(camPos));
      if (t >= 1) intro = 0;
    } else {
      const k = 1 - Math.exp(-2.2 * dt);
      camPos.lerp(want, k); camQ.slerp(probe.quaternion, k);
      if (Math.abs(camera.fov - V.fov) > 0.01) { camera.fov += (V.fov - camera.fov) * k; camera.updateProjectionMatrix(); }
    }
    camera.position.copy(camPos); camera.quaternion.copy(camQ);
    if (W.dust && out) W.dust.visible = false;
  }
  // (a short fade as the view comes back in to the desk)
  function fade() {
    const f = document.createElement('div'); f.className = 'dkb-fade'; document.body.appendChild(f);
    requestAnimationFrame(() => requestAnimationFrame(() => f.classList.add('is-gone')));
    setTimeout(() => f.remove(), 700);
  }

  function close() {
    if (closed) return;
    closed = true;
    W.renderer.domElement.removeEventListener('pointerdown', onTap);
    removeEventListener('keydown', onKey);
    W.rooms = roomsWas;
    if (W.dust) W.dust.visible = dustWas;
    S0.held(false); S0.sync(crew, true);
    fade();
  }
  reset();
  return {
    now, ready, right, wrong, head, play, over, update, aim, close,
    // (for the rigs: where the build is, the faces to tap on screen, a tap on one, a view to look from)
    state: () => ({ cur, finished, tested, heard, view: viewNow, queue: queue.length, braced: [...braced].sort(), loose: +loose.toFixed(2), built: crew ? antennaOf(crew).built : cur, repaired: crew ? antennaOf(crew).repaired : false, out, intro: +Math.max(0, intro - introT).toFixed(2), made: M.ms }),
    look: (name = null) => { forced = name && VIEW[name] ? name : null; },
    facesOnScreen: () => {
      const r = W.renderer.domElement.getBoundingClientRect(), list = [], v = new THREE.Vector3();
      W.camera.updateMatrixWorld();
      for (const t of M.targets) { t.geometry.computeBoundingSphere(); v.copy(t.geometry.boundingSphere.center); toWorld(v).project(W.camera); list.push({ k: t.userData.face, x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, braced: braced.has(t.userData.face) }); }
      return list;
    },
    brace,
  };
}
export { KFACES, TOP };
