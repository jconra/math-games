// THE HILLTOP: sky, the hill falling away on all sides, the mill house, trees and grass that bend in the wind, dust and
// leaves blowing past, the lumber pile on its sawhorses, the four footing stones the tower stands on, and the miller.
// Metres here (the tower's feet are turned into metres where it is drawn: FT).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { plankTexture, boardTexture, softDot, rng } from './wood.js';
import { stoneLb } from './frame.js';

export const FT = 0.3048;
const GAME = new URL('../../', import.meta.url).href;            // the game's folder (read only: models, textures)
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

// the shape of the hill: flat round the tower, then falling away, with gentle lumps
function hillY(x, z) {
  const r = Math.hypot(x, z), fall = Math.max(0, r - 11);
  return -fall * fall * 0.011 - fall * 0.05 + (Math.sin(x * 0.11) * Math.cos(z * 0.13) + Math.sin(x * 0.037 + z * 0.05)) * Math.min(1, fall / 10) * 1.6;
}
// a level yard dug into the slope for the mill house (it stands at MILL_AT), blending back into the hill
const MILL_AT = [-10.5, -9.5], MILL_Y = hillY(MILL_AT[0], MILL_AT[1]);
export function groundY(x, z) {
  const d = Math.hypot(x - MILL_AT[0], z - MILL_AT[1]), t = Math.min(1, Math.max(0, (d - 5) / 4));
  return MILL_Y + (hillY(x, z) - MILL_Y) * t * t * (3 - 2 * t);
}

// the wind every swaying thing reads: dir (where it blows TO, flat, length 1) and level (0 still .. 1 a big gust)
export const wind = { dir: new THREE.Vector3(1, 0, 0), level: 0, time: 0 };
// shared uniforms for the bending shaders
const windU = { uWind: { value: new THREE.Vector3() }, uTime: { value: 0 } };

// make a material bend with the wind: world-space push growing with height above the model's foot (h0 .. h1 in the
// model's own units), amount: metres of push at the top in a big gust, flutter: a quick shiver (leaves)
function bendable(mat, { h1 = 1, amount = 0.6, flutter = 0 } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = windU.uWind; sh.uniforms.uTime = windU.uTime;
    sh.vertexShader = 'uniform vec3 uWind; uniform float uTime;\n' + sh.vertexShader.replace('#include <project_vertex>', `
      vec4 mvPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      mvPosition = modelMatrix * mvPosition;
      float hN = clamp(position.y / ${h1.toFixed(3)}, 0.0, 1.0);
      float bend = hN * hN;
      // each spot sways on its own beat (from where it stands), the gusts push everything the same way
      float beat = 0.75 + 0.25 * sin(uTime * 1.9 + mvPosition.x * 0.31 + mvPosition.z * 0.23);
      mvPosition.xz += uWind.xz * bend * beat * ${amount.toFixed(3)};
      mvPosition.y -= length(uWind.xz) * bend * hN * ${(amount * 0.18).toFixed(3)};
      ${flutter ? `mvPosition.xyz += ${flutter.toFixed(3)} * (0.2 + length(uWind.xz)) * vec3(sin(uTime * 11.0 + position.x * 3.1), sin(uTime * 13.0 + position.z * 2.7), cos(uTime * 12.0 + position.y * 2.3)) * bend;` : ''}
      mvPosition = viewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  mat.customProgramCacheKey = () => 'windmill-bend-' + h1 + '-' + amount + '-' + flutter;
  return mat;
}

// THE YARD: the four footing stones and the lumber pile on its sawhorses, added to `parent` (metres, the tower's middle
// at 0, 0; ground(x, z): the ground's height there). makeScene puts it on the hilltop; the game puts it at the mill hill.
//   const Y = makeYard(parent, { ground })  ->  { setStones(W, D), setPile(n), stones, pile, update(dt), dispose() }
export function makeYard(parent, { ground = groundY } = {}) {
  const scene = parent;
  // ── the footing stones under the four corners (they move when the builder sets the base) ─────────────────────────
  // Flat fieldstones, all about as thick: their size goes with their weight in the tipping check (frame.js stoneLb, of
  // the narrower way across), so a wide base sits on big stones (about two and a half feet across at 6 feet apart) and
  // a narrow one on small ones. setStones(W, D): W across the front (X), D along the sides (Z), feet.
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x8d877c });
  const stones = [0, 1, 2, 3].map((c) => {
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), stoneMat);
    s.rotation.y = c * 1.9 + 0.4; s.castShadow = s.receiveShadow = true; scene.add(s); return s;
  });
  const CORNER = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
  function setStones(W, D = W) {
    const hx = W / 2 * FT, hz = D / 2 * FT, size = 1.9 * Math.sqrt(stoneLb(Math.min(W, D)) / stoneLb(6));
    stones.forEach((s, c) => { const x = CORNER[c][0] * hx, z = CORNER[c][1] * hz; s.position.set(x, ground(x, z), z); s.scale.set(size, 0.45 * 1.9 * 0.75, size); });
  }
  setStones(6, 6);

  // ── the lumber pile on two sawhorses: one board drawn for every full board left ────────────────────────────────────
  const pile = new THREE.Group(); pile.position.set(-3.4, ground(-3.4, -1.2), -1.2); pile.rotation.y = 1.2; pile.userData.crown = 1.4; scene.add(pile);
  const horseMat = new THREE.MeshLambertMaterial({ color: 0x5e4630 });
  for (const x of [-0.8, 0.8]) {
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.7), horseMat); top.position.set(x, 0.62, 0); pile.add(top);
    for (const s of [-1, 1]) for (const z of [-0.28, 0.28]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.68, 0.05), horseMat); leg.position.set(x + s * 0.09, 0.31, z); leg.rotation.z = s * 0.25; pile.add(leg); }
  }
  const pileTex = boardTexture(41, [182, 136, 88]); pileTex.repeat.set(1, 1);
  const pileMat = new THREE.MeshLambertMaterial({ map: pileTex });
  const pileBoards = [];
  const pileGeo = new THREE.BoxGeometry(8 * FT, 1.5 / 12 * FT, 3.5 / 12 * FT);   // (one shape for every board on the pile)
  function setPile(n) {
    for (const b of pileBoards) pile.remove(b); pileBoards.length = 0;
    for (let i = 0; i < Math.min(n, 30); i++) {
      const b = new THREE.Mesh(pileGeo, pileMat);
      const row = Math.floor(i / 6), col = i % 6;
      b.position.set((row % 2 ? 0.03 : -0.03), 0.68 + row * 0.04, -0.25 + col * 0.095); b.castShadow = true; b.receiveShadow = true;
      pile.add(b); pileBoards.push(b);
    }
  }
  // (the wind's own clock, for anything that sways: the hilltop scene keeps it itself)
  const update = (dt) => { wind.time += dt; };
  function dispose() { for (const s of stones) { parent.remove(s); s.geometry.dispose(); } parent.remove(pile); pile.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  return { setStones, setPile, stones, pile, update, dispose };
}

export function makeScene({ low = false } = {}) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xd8c8a6, 70, 520);

  // ── sky: a big ball painted from deep blue overhead to a dusty warm horizon, with a glow round the sun ──────────────
  const sunDir = new THREE.Vector3(-0.55, 0.62, 0.56).normalize();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: sunDir } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: `varying vec3 vDir; uniform vec3 uSun;
      void main(){ float h = clamp(vDir.y, -0.2, 1.0);
        vec3 top = vec3(0.24, 0.45, 0.74), mid = vec3(0.56, 0.71, 0.86), low = vec3(0.93, 0.84, 0.68);
        vec3 c = mix(low, mid, smoothstep(0.0, 0.18, h)); c = mix(c, top, smoothstep(0.18, 0.75, h));
        float s = max(dot(normalize(vDir), uSun), 0.0); c += vec3(1.0, 0.85, 0.6) * (pow(s, 64.0) * 0.8 + pow(s, 6.0) * 0.12);
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  scene.add(sky);
  // a few flat clouds
  const cloudTex = softDot(128);
  const cr = rng(5);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: 0xfff8ec, transparent: true, opacity: 0.55 + cr() * 0.3, depthWrite: false, fog: false }));
    const a = cr() * Math.PI * 2, r = 380 + cr() * 250; m.position.set(Math.cos(a) * r, 90 + cr() * 110, Math.sin(a) * r);
    m.scale.set(140 + cr() * 160, 30 + cr() * 30, 1); scene.add(m);
  }

  // ── light ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  scene.add(new THREE.HemisphereLight(0xcfe0f5, 0x7a6040, 0.85));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
  sun.position.copy(sunDir).multiplyScalar(40); sun.castShadow = true;
  sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  const sc = sun.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 16; sc.bottom = -8; sc.near = 5; sc.far = 90;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  scene.add(sun); scene.add(sun.target);

  // ── the hill ───────────────────────────────────────────────────────────────────────────────────────────────────────
  const tl = new THREE.TextureLoader();
  const grassTex = tl.load(GAME + 'textures/ground/grassDry.jpg'); grassTex.colorSpace = THREE.SRGBColorSpace;
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(60, 60); grassTex.anisotropy = 4;
  const hillGeo = new THREE.PlaneGeometry(900, 900, 120, 120); hillGeo.rotateX(-Math.PI / 2);
  // (more rows near the middle would be nicer; the plateau is flat, so plain rows do)
  const hp = hillGeo.attributes.position;
  for (let i = 0; i < hp.count; i++) hp.setY(i, groundY(hp.getX(i), hp.getZ(i)));
  hillGeo.computeVertexNormals();
  const hill = new THREE.Mesh(hillGeo, new THREE.MeshLambertMaterial({ map: grassTex, color: 0xfff2d0 }));
  hill.receiveShadow = true; scene.add(hill);
  // a worn dirt patch round the tower (the miller's yard): a disc of the game's dirt that fades out at its edge
  const dirtTex = tl.load(GAME + 'textures/ground/dirt.jpg'); dirtTex.colorSpace = THREE.SRGBColorSpace;
  dirtTex.wrapS = dirtTex.wrapT = THREE.RepeatWrapping; dirtTex.repeat.set(5, 5);
  const fadeCv = document.createElement('canvas'); fadeCv.width = fadeCv.height = 128;
  const fg = fadeCv.getContext('2d'), grd = fg.createRadialGradient(64, 64, 10, 64, 64, 64);
  grd.addColorStop(0, '#fff'); grd.addColorStop(0.55, '#ddd'); grd.addColorStop(1, '#000'); fg.fillStyle = grd; fg.fillRect(0, 0, 128, 128);
  const yard = new THREE.Mesh(new THREE.CircleGeometry(7.5, 48), new THREE.MeshLambertMaterial({ map: dirtTex, alphaMap: new THREE.CanvasTexture(fadeCv), transparent: true, depthWrite: false, color: 0xf2e2c4 }));
  yard.rotation.x = -Math.PI / 2; yard.position.set(-1.5, 0.01, -1); yard.receiveShadow = true; yard.renderOrder = 1; scene.add(yard);
  // far hills all round, pale in the haze
  const farGeo = new THREE.CylinderGeometry(560, 600, 60, 64, 3, true); const fp = farGeo.attributes.position;
  for (let i = 0; i < fp.count; i++) { const a = Math.atan2(fp.getZ(i), fp.getX(i)); if (fp.getY(i) > 0) fp.setY(i, 10 + 30 * (0.5 + 0.5 * Math.sin(a * 5) * Math.cos(a * 3 + 1)) + 12 * Math.sin(a * 17)); }
  farGeo.computeVertexNormals();
  const far = new THREE.Mesh(farGeo, new THREE.MeshLambertMaterial({ color: 0x9a9070, side: THREE.BackSide }));
  far.position.y = -40; scene.add(far);

  // ── the footing stones and the lumber pile (makeYard) ──────────────────────────────────────────────────────────
  const theYard = makeYard(scene), { stones, setStones, setPile, pile } = theYard;

  // ── the mill house: a stone ground floor, plank walls above, a shingle roof, a door, flour sacks ───────────────────
  const mill = new THREE.Group(); mill.position.set(MILL_AT[0], 0, MILL_AT[1]); mill.rotation.y = 0.6; mill.userData.crown = 4.2; scene.add(mill);
  const planks = plankTexture(3, [128, 92, 60]); planks.repeat.set(3, 1.2);
  const stone = new THREE.MeshLambertMaterial({ color: 0x9c958a });
  // the hill falls away under it: stand it on the highest corner and run the stone footing down past the lowest
  const corners = [[-3, -2.5], [3, -2.5], [-3, 2.5], [3, 2.5], [0, 0]].map(([a, b]) => groundY(mill.position.x + a * Math.cos(0.6) + b * Math.sin(0.6), mill.position.z - a * Math.sin(0.6) + b * Math.cos(0.6)));
  const hi = Math.max(...corners), drop = hi - Math.min(...corners) + 0.4; mill.position.y = hi;
  const base = new THREE.Mesh(new THREE.BoxGeometry(6, 1.6 + drop, 5), stone); base.position.y = 0.8 - drop / 2; mill.add(base);
  const walls = new THREE.Mesh(new THREE.BoxGeometry(5.8, 2.6, 4.8), new THREE.MeshLambertMaterial({ map: planks })); walls.position.y = 2.9; mill.add(walls);
  // the roof: a long triangle shape pushed out into a prism
  const rs = new THREE.Shape(); rs.moveTo(-3.3, 0); rs.lineTo(0, 2.2); rs.lineTo(3.3, 0); rs.lineTo(-3.3, 0);
  const roofGeo = new THREE.ExtrudeGeometry(rs, { depth: 5.6, bevelEnabled: false }); roofGeo.translate(0, 0, -2.8);
  const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0x5b3f2c })); roof.position.y = 4.2; roof.rotation.y = Math.PI / 2; mill.add(roof);
  const gableTex = plankTexture(9, [118, 84, 54]); gableTex.repeat.set(2, 1);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.9, 0.1), new THREE.MeshLambertMaterial({ map: gableTex, color: 0x8a6a4a })); door.position.set(1, 1.05, 2.53); mill.add(door);
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.08), new THREE.MeshLambertMaterial({ color: 0x2a2018 })); win.position.set(-1.5, 3.1, 2.42); mill.add(win);
  const sackMat = new THREE.MeshLambertMaterial({ color: 0xe8e0cc });
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.35, 4, 8), sackMat);
    s.position.set(2.2 + (i % 3) * 0.46, 0.25 + (i > 2 ? 0.4 : 0), 2.9 + (i > 2 ? 0 : 0.05)); s.rotation.z = Math.PI / 2 + (i - 2) * 0.1; s.scale.set(1, 1, 0.75); mill.add(s);
  }
  const millstone = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.25, 20), stone); millstone.position.set(-2.4, 0.7, 2.75); millstone.rotation.x = Math.PI / 2 - 0.25; mill.add(millstone);
  mill.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // ── trees nearby (the game's own, bent by the wind in their shader) ────────────────────────────────────────────────
  const treeSpots = [
    { file: 'oak_sparse', x: 7.5, z: -4.5, h: 8.5 }, { file: 'pine_sparse', x: -12.5, z: 3, h: 9.5 }, { file: 'oak_sparse', x: 10.5, z: 6, h: 7.5 },
    { file: 'pine_sparse', x: -4, z: -13, h: 10 }, { file: 'oak_sparse', x: 18, z: -14, h: 9 }, { file: 'pine_sparse', x: -20, z: -10, h: 11 },
    { file: 'oak_sparse', x: 3, z: 15, h: 7 },
  ];
  const trees = new THREE.Group(); scene.add(trees);
  const treeLoad = Promise.all(['oak_sparse', 'pine_sparse'].map((f) => loader.loadAsync(GAME + 'models/trees/' + f + '.glb').then((g) => [f, g.scene]).catch(() => [f, null])))
    .then((list) => {
      const proto = Object.fromEntries(list);
      // bend the shared materials once (the trees are about 70 model units tall)
      for (const s of Object.values(proto)) if (s) s.traverse((o) => {
        if (!o.isMesh) return;
        const leaves = /leaf|leaves/i.test(o.material.name || '');
        o.material = bendable(o.material.clone(), { h1: 70, amount: leaves ? 1.9 : 1.6, flutter: leaves ? 0.06 : 0 });
        o.material.userData.done = true;
      });
      for (const t of treeSpots) {
        let m = proto[t.file] ? proto[t.file].clone() : codeTree();
        if (proto[t.file]) m.scale.setScalar(t.h / 66);
        m.position.set(t.x, groundY(t.x, t.z) - 0.1, t.z); m.rotation.y = t.x * 1.7 + t.z; m.userData.crown = t.h * 0.36;
        m.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = !low && Math.hypot(t.x, t.z) < 12; } });
        trees.add(m);
      }
    });
  // (if the game's trees can't load: a plain trunk and a ball of leaves, still bending)
  function codeTree() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 3, 7).translate(0, 1.5, 0), bendable(new THREE.MeshLambertMaterial({ color: 0x5b4330 }), { h1: 6, amount: 0.7 }));
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1).translate(0, 4, 0), bendable(new THREE.MeshLambertMaterial({ color: 0x6f7a3a, flatShading: true }), { h1: 6, amount: 0.9 }));
    g.add(trunk, crown); return g;
  }

  // ── grass tufts round the yard: a few thin blades each, bending with the wind (one instanced mesh) ─────────────────
  const blade = (() => {
    const pos = [], col = [], r = rng(11);
    for (let i = 0; i < 6; i++) {
      const a = r() * Math.PI * 2, lean = 0.04 + r() * 0.1, hgt = 0.18 + r() * 0.22, w = 0.02;
      const cx = Math.cos(a), cz = Math.sin(a), px = -cz * w, pz = cx * w;
      pos.push(px, 0, pz, -px, 0, -pz, cx * lean, hgt, cz * lean);
      col.push(0.55, 0.47, 0.26, 0.55, 0.47, 0.26, 1.0, 0.9, 0.6);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals(); return g;
  })();
  const tufts = low ? 500 : 1400;
  const grass = new THREE.InstancedMesh(blade, bendable(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { h1: 0.4, amount: 0.2, flutter: 0.015 }), tufts);
  const gm = new THREE.Matrix4(), gr = rng(17), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  for (let i = 0; i < tufts; i++) {
    let x, z; do { const a = gr() * Math.PI * 2, r = 5.5 + Math.pow(gr(), 0.8) * 16; x = Math.cos(a) * r; z = Math.sin(a) * r; } while (Math.hypot(x + 10.5, z + 9.5) < 4.2 || Math.hypot(x, z) < 5.5);
    e.set(0, gr() * 6.3, 0); q.setFromEuler(e); const s = 0.7 + gr() * 0.9; sv.set(s, s, s); pv.set(x, groundY(x, z), z);
    gm.compose(pv, q, sv); grass.setMatrixAt(i, gm);
  }
  grass.receiveShadow = true; scene.add(grass);

  // ── things blowing by: dust motes, a few leaves, and faint streaks of wind ─────────────────────────────────────────
  const BOX = { x: 26, y: 9, z: 26 };
  const DUST = low ? 260 : 600, LEAVES = low ? 60 : 130, STREAKS = 70, CLOUDS = low ? 10 : 18;
  const dustGeo = new THREE.BufferGeometry(), dustPos = new Float32Array(DUST * 3), dr = rng(23);
  for (let i = 0; i < DUST; i++) { dustPos[i * 3] = (dr() - 0.5) * 2 * BOX.x; dustPos[i * 3 + 1] = dr() * BOX.y * dr(); dustPos[i * 3 + 2] = (dr() - 0.5) * 2 * BOX.z; }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: softDot(32), color: 0xd8c098, size: 0.14, transparent: true, opacity: 0.8, depthWrite: false }));
  dust.frustumCulled = false; scene.add(dust);
  const leafGeo = new THREE.PlaneGeometry(0.09, 0.06);
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, vertexColors: false }), LEAVES);
  const leafState = []; const lc = new THREE.Color();
  for (let i = 0; i < LEAVES; i++) {
    leafState.push({ p: new THREE.Vector3((dr() - 0.5) * 2 * BOX.x, dr() * 4, (dr() - 0.5) * 2 * BOX.z), r: new THREE.Euler(dr() * 6, dr() * 6, dr() * 6), spin: new THREE.Vector3(dr() * 8, dr() * 8, dr() * 8), ph: dr() * 6 });
    leaves.setColorAt(i, lc.setHSL(0.1 + dr() * 0.12, 0.55, 0.3 + dr() * 0.2));
  }
  leaves.frustumCulled = false; scene.add(leaves);
  const streakPos = new Float32Array(STREAKS * 6), streakState = [];
  for (let i = 0; i < STREAKS; i++) streakState.push({ p: new THREE.Vector3((dr() - 0.5) * 2 * BOX.x, 0.5 + dr() * 7, (dr() - 0.5) * 2 * BOX.z), len: 1.5 + dr() * 2.5, sp: 0.8 + dr() * 0.6 });
  const streakGeo = new THREE.BufferGeometry(); streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3));
  const streaks = new THREE.LineSegments(streakGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
  streaks.frustumCulled = false; scene.add(streaks);

  // clouds of dust rolling along the ground in the strong gusts (big soft sprites)
  const cloudMat = new THREE.SpriteMaterial({ map: softDot(64), color: 0xd2bb94, transparent: true, opacity: 0, depthWrite: false });
  const dustClouds = [];
  for (let i = 0; i < CLOUDS; i++) {
    const sp = new THREE.Sprite(cloudMat.clone()); sp.position.set((dr() - 0.5) * 2 * BOX.x, 0.5 + dr() * 1.4, (dr() - 0.5) * 2 * BOX.z);
    const sz = 4 + dr() * 5; sp.scale.set(sz * 1.6, sz * 0.7, 1); sp.userData = { ph: dr() * 6, sp: 0.7 + dr() * 0.5 }; scene.add(sp); dustClouds.push(sp);
  }
  const wrap = (v, centre) => {
    for (const k of ['x', 'z']) { const half = BOX[k]; let d = v[k] - centre[k]; if (d > half) v[k] -= half * 2; else if (d < -half) v[k] += half * 2; }
  };
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Vector3(0, 0, 0);
  // a tree (or the mill house) standing between the eye and the tower, or round the eye itself, is left out while it
  // is in the way, so walking round the tower never puts a crown of leaves or a wall over the view
  function clearView(eye) {
    const ex = eye.x, ez = eye.z, L2 = ex * ex + ez * ez || 1;
    // (the lumber pile too: seen from the left it stands right in front of the tower's foot)
    for (const m of [...trees.children, mill, pile]) {
      const r = m.userData.crown || 3, tx = m.position.x, tz = m.position.z;
      const u = ((tx - ex) * -ex + (tz - ez) * -ez) / L2;            // 0 at the eye, 1 at the tower
      const d = Math.hypot(ex + -ex * Math.max(0, Math.min(1, u)) - tx, ez + -ez * Math.max(0, Math.min(1, u)) - tz);
      const inWay = (u > -0.05 && u < 0.85 && d < r) || Math.hypot(tx - ex, tz - ez) < r + 1;
      m.visible = !inWay;
    }
  }
  // how many of each are showing grows with the wind; the rest wait out of sight
  function update(dt, centre, eye = null) {
    wind.time += dt;
    if (eye) clearView(eye);
    const L = wind.level, gust = L * (0.82 + 0.18 * Math.sin(wind.time * 2.3) * Math.sin(wind.time * 0.7 + 1));
    windU.uTime.value = wind.time; windU.uWind.value.copy(wind.dir).multiplyScalar(gust);
    const speed = 1.5 + L * 15, d = wind.dir;
    const nDust = Math.floor(DUST * Math.min(1, 0.06 + L * 1.1));
    for (let i = 0; i < DUST; i++) {
      const j = i * 3, s = speed * (0.6 + (i % 7) * 0.08);
      dustPos[j] += (d.x * s + Math.sin(wind.time * 3 + i) * 0.4) * dt; dustPos[j + 2] += (d.z * s + Math.cos(wind.time * 2.6 + i) * 0.4) * dt;
      dustPos[j + 1] += (Math.sin(wind.time * 1.7 + i * 0.37) * 0.5 + L * 0.3) * dt;
      if (dustPos[j + 1] > BOX.y * (0.3 + L * 0.7)) dustPos[j + 1] = 0.05;
      const v = { x: dustPos[j], z: dustPos[j + 2] }; wrap(v, centre); dustPos[j] = v.x; dustPos[j + 2] = v.z;
    }
    dustGeo.attributes.position.needsUpdate = true; dustGeo.setDrawRange(0, nDust);
    dust.material.opacity = 0.35 + L * 0.5;
    const nLeaves = Math.floor(LEAVES * Math.min(1, L * 1.2));
    for (let i = 0; i < LEAVES; i++) {
      const s = leafState[i];
      if (i >= nLeaves) { tmpM.compose(s.p, tmpQ, zero); leaves.setMatrixAt(i, tmpM); continue; }
      s.p.x += (d.x * speed * 0.8 + Math.sin(wind.time * 4 + s.ph) * 0.8) * dt; s.p.z += (d.z * speed * 0.8 + Math.cos(wind.time * 3.3 + s.ph) * 0.8) * dt;
      s.p.y += (Math.sin(wind.time * 2.4 + s.ph) * 1.2 + 0.15) * dt; if (s.p.y > 7 || s.p.y < 0.1) s.p.y = 0.3 + Math.random() * 3;
      wrap(s.p, centre);
      s.r.x += s.spin.x * dt; s.r.y += s.spin.y * dt; s.r.z += s.spin.z * dt; tmpQ.setFromEuler(s.r);
      // (a leaf right in front of the lens would fill the screen: it is left out while it passes)
      tmpM.compose(s.p, tmpQ, eye && s.p.distanceToSquared(eye) < 9 ? zero : one); leaves.setMatrixAt(i, tmpM);
    }
    leaves.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < STREAKS; i++) {
      const s = streakState[i]; s.p.x += d.x * speed * 1.4 * s.sp * dt; s.p.z += d.z * speed * 1.4 * s.sp * dt; wrap(s.p, centre);
      const j = i * 6; streakPos[j] = s.p.x; streakPos[j + 1] = s.p.y; streakPos[j + 2] = s.p.z;
      streakPos[j + 3] = s.p.x - d.x * s.len * (0.3 + L); streakPos[j + 4] = s.p.y + Math.sin(wind.time * 3 + i) * 0.05; streakPos[j + 5] = s.p.z - d.z * s.len * (0.3 + L);
    }
    streakGeo.attributes.position.needsUpdate = true; streaks.material.opacity = Math.max(0, (L - 0.25) * 0.8);
    for (const c of dustClouds) {
      c.position.x += d.x * speed * 0.7 * c.userData.sp * dt; c.position.z += d.z * speed * 0.7 * c.userData.sp * dt; wrap(c.position, centre);
      c.material.opacity = Math.min(0.5, Math.max(0, L - 0.3) * 0.75) * (0.55 + 0.45 * Math.sin(wind.time * 0.9 + c.userData.ph));
    }
  }

  return { scene, sun, sky, setPile, setStones, stones, update, treeLoad, mill, pile };
}

// ── the miller: one of the game's townsfolk, dusted with flour. If the game's people can't load, a plain figure ───────
export async function makeMiller(scene) {
  let person = null;
  try {
    const { loadFolk, makePerson } = await import('../../src/actors/folk.js');
    const lib = await loadFolk(GAME);
    person = makePerson(lib, { outfit: 'casual_m', palette: ['#e6dcc6', '#6b5843', '#3b2a1e', '#d8ccb2'], skin: 3, hair: 8, hat: true });
    person.play('Idle', { fade: 0 });
  } catch (err) {
    console.warn('windmill lab: the game\'s people did not load, using a plain miller', err);
    const g = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ color: 0xe6dcc6 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.9, 4, 8), mat); body.position.y = 0.95; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), new THREE.MeshLambertMaterial({ color: 0xc68d62 })); head.position.y = 1.62; g.add(head);
    person = { root: g, play() { return false; }, update() {} };
  }
  person.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  scene.add(person.root);
  return person;
}
