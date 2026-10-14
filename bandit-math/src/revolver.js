// THE SIX-SHOOTER: a single-action revolver made in code (boxes and cylinders, chunky and faceted like the rest of the
// game's code-made things), held in the rider's hand at the bottom right of the view while they shoot at the range
// (src/missions/shooting.js). Blued barrel, case-hardened frame, a turning cylinder with six chambers, a hammer that
// cocks, a brass trigger guard and a walnut grip; the hand round the grip in the rider's own skin, the sleeve in their
// shirt's colour.
//
// It is drawn in a small scene of its own, over the valley's frame, with its own camera (a normal 50 degree view): the
// range's view is narrow, like looking down a barrel, and a gun drawn through that would fill the screen. Its light
// follows the valley's sun and sky, turned into the view's own frame, so it is lit like the world behind it.
//
//   const G = makeRevolver({ look })     look: the rider's look (skin, palette) for the hand and sleeve
//   G.aim(x, y)        where it points: the page's pixel (it turns to it, quickly but not at once)
//   G.fire()           -> true when it fired (false while reloading or still cocking): the hammer falls, a flash and
//                      a puff of smoke at the muzzle, the kick; the cylinder turns to the next chamber as the hammer
//                      is cocked again. The sixth shot starts a reload by itself
//   G.reload()         a reload now (if not full): the gun tips over, the cylinder spins, six fresh rounds
//   G.rounds           rounds left (0..6);  G.reloading;  G.ready (it can fire now)
//   G.show(on)         drawn up into view, or put away
//   G.update(dt, { camera, W })   each frame: camera: the game's camera (for the sun's direction in the view's frame)
//   G.render(renderer) draws it over what is on the screen (after the valley's frame)
//   G.dispose()
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTES, SKINS } from './actors/folk.js';

export const GUN = {
  rounds: 6,
  fov: 50,              // degrees: the gun's own view
  at: { x: 0.2, y: -0.2, z: -0.6 },      // where the hand holds it, in the view's frame (metres; a phone held upright: nearer the middle)
  follow: 16,           // how fast it turns to a new aim (a damp rate)
  cock: 0.3,            // s after a shot before it can fire again (the thumb cocks the hammer, the cylinder turns)
  kick: 0.24,           // radians the muzzle jumps up
  back: 0.035,          // metres it jumps back
  settle: 9,            // how fast it comes back down from the kick
  reload: 1.25,         // s a reload takes
  flash: 0.06,          // s the muzzle flash shows
  smoke: 1.1,           // s a puff of smoke lasts
};

const COL = { blued: '#2a2f35', frame: '#5b4d40', steel: '#7b8288', dark: '#14171a', brass: '#c09a48', wood: '#6b3f22', woodDark: '#4a2a16' };

// a box or cylinder as a coloured piece: placed, turned (radians, as Euler XYZ), no uvs
function piece(geo, color, { at = [0, 0, 0], rot = [0, 0, 0] } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(1, 1, 1)));
  const c = new THREE.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (g.attributes.normal) g.deleteAttribute('normal');
  g.computeVertexNormals();
  return g;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r, len, seg = 10) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2);   // (along +Z)

// a soft round picture for the flash and the smoke
function puffPicture(inner, outer) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner); g.addColorStop(0.45, outer); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function makeRevolver({ look = {} } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(GUN.fov, innerWidth / innerHeight, 0.02, 20);
  const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x6a5a40, 1.1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2dc, 2.2); scene.add(sun); scene.add(sun.target);
  const flashLight = new THREE.PointLight(0xffb060, 0, 1.2, 2); scene.add(flashLight);

  const metal = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.4, roughness: 0.42, flatShading: true });
  const matte = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0, roughness: 0.78, flatShading: true });

  // ── THE GUN (in its own frame: +Z the muzzle's way, +Y up, the trigger at the origin) ─────────────────────────
  const aimer = new THREE.Group(); scene.add(aimer);            // turned to the aim
  const kicker = new THREE.Group(); aimer.add(kicker);          // the kick and the reload's tip
  const gun = new THREE.Group(); kicker.add(gun);
  gun.position.set(0, 0.02, -0.03);                             // (turned about a point a little behind the trigger: the wrist)
  const body = mergeGeometries([
    piece(box(0.026, 0.044, 0.062), COL.frame, { at: [0, 0.03, 0.012] }),                   // the frame
    piece(box(0.018, 0.009, 0.064), COL.frame, { at: [0, 0.057, 0.012] }),                  // the top strap
    piece(cyl(0.0088, 0.14, 8), COL.blued, { at: [0, 0.047, 0.112] }),                       // the barrel
    piece(cyl(0.0102, 0.01, 8), COL.blued, { at: [0, 0.047, 0.044] }),                       // its shoulder
    piece(box(0.003, 0.009, 0.014), COL.blued, { at: [0, 0.058, 0.176] }),                   // the front sight
    piece(cyl(0.0052, 0.095, 6), COL.blued, { at: [0.0072, 0.033, 0.09] }),                  // the ejector rod's housing
    piece(box(0.012, 0.006, 0.008), COL.blued, { at: [0, 0.013, 0.05] }),                    // under the cylinder
    piece(new THREE.TorusGeometry(0.0145, 0.0026, 4, 10, Math.PI).rotateY(Math.PI / 2).rotateX(Math.PI), COL.brass, { at: [0, 0.009, 0.007] }),   // the trigger guard
    piece(box(0.003, 0.017, 0.0045), COL.steel, { at: [0, 0.006, 0.004], rot: [0.35, 0, 0] }),   // the trigger
    piece(box(0.016, 0.03, 0.02), COL.brass, { at: [0, 0.004, -0.018], rot: [-0.32, 0, 0] }),   // the grip's frame, brass
  ]);
  gun.add(new THREE.Mesh(body, metal));
  const grip = mergeGeometries([
    piece(box(0.025, 0.074, 0.03), COL.wood, { at: [0, -0.024, -0.03], rot: [-0.38, 0, 0] }),
    piece(cyl(0.016, 0.026, 8).rotateY(Math.PI / 2), COL.woodDark, { at: [0, -0.058, -0.044] }),   // the round butt
  ]);
  gun.add(new THREE.Mesh(grip, matte));
  // the cylinder: six chambers round it (dark holes on its back face) and six flutes; it turns a sixth with each shot
  const cylParts = [piece(cyl(0.0195, 0.042, 12), COL.steel)];
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3, c = Math.cos(a), s = Math.sin(a);
    cylParts.push(piece(cyl(0.0048, 0.044, 6), COL.dark, { at: [c * 0.0115, s * 0.0115, 0] }));      // a chamber
    cylParts.push(piece(box(0.004, 0.003, 0.03), COL.dark, { at: [Math.cos(a + Math.PI / 6) * 0.0193, Math.sin(a + Math.PI / 6) * 0.0193, 0], rot: [0, 0, a + Math.PI / 6 + Math.PI / 2] }));   // a flute
  }
  const cylinder = new THREE.Mesh(mergeGeometries(cylParts), metal);
  cylinder.position.set(0, 0.033, 0.018);
  gun.add(cylinder);
  // the hammer: turns back about its pin to cock, falls forward to fire
  const hammerPin = new THREE.Group(); hammerPin.position.set(0, 0.046, -0.022); gun.add(hammerPin);
  const hammer = new THREE.Mesh(mergeGeometries([
    piece(box(0.007, 0.024, 0.009), COL.blued, { at: [0, 0.009, 0] }),
    piece(box(0.008, 0.007, 0.016), COL.blued, { at: [0, 0.02, -0.007], rot: [0.5, 0, 0] }),     // the spur
  ]), metal);
  hammerPin.add(hammer);
  // the hand round the grip and the sleeve back to the corner of the view
  const skin = typeof look.skin === 'string' ? look.skin : SKINS[typeof look.skin === 'number' ? look.skin : 3];
  const shirt = (PALETTES[look.palette] || PALETTES.drifter)[0];
  const knuckle = new THREE.Color(skin).multiplyScalar(0.88).getStyle();
  const hand = mergeGeometries([
    piece(box(0.034, 0.058, 0.038), skin, { at: [0.003, -0.03, -0.036], rot: [-0.38, 0, 0] }),     // the palm round the back of the grip
    ...[0, 1, 2].map((k) => piece(box(0.03, 0.016, 0.018), knuckle, { at: [0.002, -0.006 - k * 0.0175, -0.01 - k * 0.007], rot: [-0.38, 0, 0] })),   // three fingers round its front
    piece(box(0.012, 0.012, 0.04), skin, { at: [-0.016, 0.03, -0.012], rot: [-0.25, 0.12, 0] }),  // the thumb, along the frame
    piece(box(0.009, 0.009, 0.024), skin, { at: [0.002, 0.008, 0.01], rot: [0.55, 0, 0] }),        // the trigger finger
    piece(cyl(0.023, 0.06, 7), skin, { at: [0.006, -0.058, -0.075], rot: [-0.62, 0.15, 0] }),       // the wrist
    piece(cyl(0.036, 0.05, 8), shirt, { at: [0.012, -0.08, -0.11], rot: [-0.62, 0.15, 0] }),        // the cuff
    piece(cyl(0.034, 0.36, 8), shirt, { at: [0.035, -0.17, -0.25], rot: [-0.62, 0.15, 0] }),        // the sleeve
  ]);
  gun.add(new THREE.Mesh(hand, matte));

  // ── THE FLASH AND THE SMOKE ──────────────────────────────────────────────────────────────────────────────────
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.047, 0.19); gun.add(muzzle);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffPicture('rgba(255,250,220,1)', 'rgba(255,170,60,0.85)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
  flash.visible = false; scene.add(flash);
  const smokeMap = puffPicture('rgba(235,232,225,0.75)', 'rgba(200,196,188,0.35)');
  const puffs = [];
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeMap, depthWrite: false, transparent: true, opacity: 0 }));
    s.visible = false; scene.add(s); puffs.push({ s, t: 9, v: new THREE.Vector3() });
  }

  // ── STATE ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const G = { scene, camera, rounds: GUN.rounds, reloading: false, get ready() { return !G.reloading && wait <= 0 && shown > 0.9; } };
  let wait = 0, kick = 0, kickV = 0, back = 0, flashT = 0, reloadT = 0, cylTurn = 0, cylTo = 0, cock = 1, want = 1, shown = 0, showTo = 0;
  const aimAt = new THREE.Vector3(0, 0, -10), aimNow = new THREE.Vector3(0, 0, -10), _v = new THREE.Vector3(), _q = new THREE.Quaternion();

  G.aim = (x, y) => {
    const nx = (x / innerWidth) * 2 - 1, ny = 1 - (y / innerHeight) * 2;
    aimAt.set(nx, ny, 0.5).unproject(camera).normalize().multiplyScalar(10);
  };
  G.fire = () => {
    if (!G.ready || G.rounds <= 0) return false;
    G.rounds--; wait = GUN.cock;
    kickV = GUN.kick * 14; back = GUN.back;
    cock = 0; want = 0;                       // (the hammer falls)
    flashT = GUN.flash;
    for (let k = 0, n = 0; k < puffs.length && n < 3; k++) {
      const p = puffs[k]; if (p.t < GUN.smoke) continue;
      muzzle.getWorldPosition(p.s.position);
      p.v.set((Math.random() - 0.5) * 0.08, 0.12 + Math.random() * 0.1, -0.1 - Math.random() * 0.2).add(_v.subVectors(p.s.position, camera.position).normalize().multiplyScalar(0.25));
      p.t = -n * 0.04; p.s.visible = true; n++;
    }
    setTimeout(() => { want = 1; cylTo += Math.PI / 3; }, 140);   // (the thumb cocks it again, turning the next chamber up)
    if (G.rounds === 0) setTimeout(() => G.reload(), 380);
    return true;
  };
  G.reload = () => {
    if (G.reloading || G.rounds >= GUN.rounds) return false;
    G.reloading = true; reloadT = 0;
    return true;
  };
  G.show = (on) => { showTo = on ? 1 : 0; };

  G.update = (dt, { camera: view = null, W = null } = {}) => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    // where the hand holds it: a phone held upright, nearer the middle so the gun stays on the screen
    const a = camera.aspect, ax = Math.max(0.075, Math.min(GUN.at.x, 0.05 + 0.075 * a));
    shown += (showTo - shown) * Math.min(1, dt * 7);
    aimer.position.set(ax, GUN.at.y - (1 - shown) * 0.3, GUN.at.z);
    // turn to the aim
    aimNow.lerp(aimAt, 1 - Math.exp(-GUN.follow * dt));
    aimer.lookAt(_v.copy(aimNow));
    // the kick: a spring that throws the muzzle up and brings it back
    kickV += (-kick * GUN.settle * GUN.settle - kickV * 2 * GUN.settle * 0.75) * dt;
    kick += kickV * dt; kick = Math.max(-0.2, Math.min(0.9, kick));
    back *= Math.exp(-dt * 10);
    let roll = 0, dip = 0;
    if (G.reloading) {
      reloadT += dt;
      const f = Math.min(1, reloadT / GUN.reload), tip = Math.sin(Math.min(1, f * 1.25) * Math.PI);   // (over and back)
      roll = tip * 1.0; dip = tip * 0.35;
      cylTurn += dt * 18 * tip;                                    // (spun as the rounds go in)
      if (reloadT >= GUN.reload) { G.reloading = false; G.rounds = GUN.rounds; cylTo = cylTurn = Math.round(cylTurn / (Math.PI / 3)) * Math.PI / 3; }
    }
    kicker.rotation.set(-kick - dip, 0, roll);
    kicker.position.set(0, 0, back);
    cock += (want - cock) * Math.min(1, dt * (want ? 14 : 60));
    hammerPin.rotation.x = -0.65 * cock;                         // (back when cocked)
    if (!G.reloading) cylTurn += (cylTo - cylTurn) * Math.min(1, dt * 18);
    cylinder.rotation.z = cylTurn;
    if (wait > 0) wait -= dt;
    // the flash: a bright star at the muzzle for a moment, lighting the gun
    if (flashT > 0) {
      flashT -= dt;
      muzzle.getWorldPosition(flash.position);
      flash.scale.setScalar(0.08 + Math.random() * 0.04); flash.material.rotation = Math.random() * 6;
      flash.visible = flashT > 0; flashLight.position.copy(flash.position); flashLight.intensity = flashT > 0 ? 3 : 0;
    } else { flash.visible = false; flashLight.intensity = 0; }
    for (const p of puffs) {
      if (p.t >= GUN.smoke) continue;
      p.t += dt;
      if (p.t < 0) { p.s.visible = false; continue; }
      const f = p.t / GUN.smoke;
      p.s.visible = p.t < GUN.smoke;
      p.s.position.addScaledVector(p.v, dt); p.v.multiplyScalar(Math.exp(-dt * 1.2)); p.v.y += dt * 0.04;
      p.s.scale.setScalar(0.025 + f * 0.085);
      p.s.material.opacity = 0.32 * (1 - f) * Math.min(1, p.t * 12);
    }
    // the light: the valley's sun and sky, turned into the view's frame
    const V = W && W.V;
    if (view && V && V.sun) {
      _q.copy(view.quaternion).invert();
      sun.position.copy(V.sun.position).sub(V.sun.target ? V.sun.target.position : _v.set(0, 0, 0)).normalize().applyQuaternion(_q);
      sun.target.position.set(0, 0, 0);
      sun.color.copy(V.sun.color); sun.intensity = V.sun.intensity * 0.85;
      if (V.hemi) { hemi.color.copy(V.hemi.color); hemi.groundColor.copy(V.hemi.groundColor); hemi.intensity = V.hemi.intensity; hemi.position.set(0, 1, 0).applyQuaternion(_q); }
    }
  };

  G.render = (renderer) => {
    if (shown < 0.01) return;
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(scene, camera);
    renderer.autoClear = auto;
  };

  G.dispose = () => {
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
    smokeMap.dispose();
  };
  return G;
}
