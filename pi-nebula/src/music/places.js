// THE MUSIC IN THE STATION'S PLACES (MUSIC 3): the music's screen, a copy in each place, and the hallways' lines. Loaded
// only when the music is on (src/main.js, with src/music/game.js); with it off the screens' faces and the lines' tubes
// are there in the station (kit: wallkit.js wallScreen 'music', musicLines) and dark, and none of this runs.
// The game's maker, 2026-11-24: "Maybe have a few screens around the station that interface with it to change the
// song, or modify the song", "Since the screens would all be copies, Id say put one in each place (storage, terminal,
// medical, control, quarters, hangers)", "some Skrillix sounding stuff for Mathball (with a control screen in there)",
// "So the screens can show visualizations and then if you interact with it then it shows the controls", "some light
// bars or something that respond the the music that are in the hallways ... Maybe it could be an option", "the ships
// should have access to the music too". 2026-11-26: "One long line for each instrument, from one end of the hallway to
// the other. Low notes light up near one end and high notes near the other", "I like 4, but I think the lines need to be
// a little thicker so the effect is overall brighter".
//
// THE SCREENS. Each always shows the picture picked on the Picture row (one for every screen, kept in this browser),
// the word MUSIC along its top (the game's maker, 2026-11-26: "the wall screens should always show the music
// visualization (And maybe say "Music" on the top)"), painted only while a screen is in view, PAINT times a second: ONE
// picture for them all (one canvas and one texture, or one shader material for Hex), so a second screen in view costs
// nothing more to paint. Walked up to, the game's prompt (as the ship store's kiosk: Music, Open, E, its button on a
// phone), and for a mouse the hand over the screen and a click; then its controls open over the game: the Music Lab's
// own panel (src/music/screen.js mountMusicControls), with the Hallway lights row and no Play / Stop (the HUD's mute
// rules the music). Done (or Esc) closes them. A change is heard at once wherever the music plays and kept (src/music/game.js edit):
// the arena's screen changes the arena's song, every other screen (aboard a ship too) the station's.
// THE LINES. In each hallway (placesplan.js HALLWAYS) the 'lines' pieces on one wall, end to end, are five long lines,
// low notes at the hallway's north or west end (placesplan.js alongOf); one small table (src/music/lights.js lightLines,
// LINE_COLS places x 5 lines) is a data texture on one glowing material for every hallway, on the face of the lines'
// rail (kit/wallkit.js musicLines: standing proud of the wall at hand height, seen down the whole hallway), worked out each frame a
// hallway with lines is drawn. No real light. Hallway lights Off: the lines are not drawn (their tubes stay, dark).
//
//   const MP = startMusicPlaces({ W, walls, input, usable, game, boarding, mission, quiet })
//     usable: the game's helper for the mouse over what can be used (src/usable.js)
//     game: src/music/game.js's G; quiet(): something else's prompt or question is up
//   MP.update(dt, P, playing)   each frame
//   MP.open(i) / MP.close() / MP.state()     (the rigs: GAME.musicPlaces); MP.screens: [{ id, room, song, at, facing }]
import * as THREE from 'three';
import { piecesOf } from '../people.js';
import { MUSIC_FACE, MUSIC_LINES, lineY } from '../../kit/wallkit.js';
import { CABIN_MUSIC, MUSIC_SCREEN } from '../../kit/ships/musicscreen.js';
import { mountMusicControls, screenLink, WALL, TITLE } from './screen.js';
import { tapOf } from './tap.js';
import { visualOf, PART_COLOURS } from './visuals.js';
import { PART_IDS } from './song.js';
import { lightLines, LINE_LOOK } from './lights.js';
import { electricUniforms } from './electric.js';
import { SCREEN_ROOMS, songOf, keptPicture, keepPicture, hallwayOn, keepHallway, HALLWAYS, alongOf } from './placesplan.js';

// how often the pictures are painted while a screen is in view; how far off a screen is still painted (m); the canvas;
// near a screen: the spot to stand, out from its face, how near it the prompt comes up and how much the view must be
// turned toward it (as the kiosk's: src/kiosk.js STAND); the lines' table's places along a line
// (the picture under the screen's title strip: TITLE, src/music/screen.js)
export const PAINT = { fps: 12, far: 24, w: 512, h: Math.round(512 * WALL.h * (1 - TITLE.share) / WALL.w) };
export const STAND = { out: 0.9, near: 2.2, facing: 0.25 };
export const LINE_COLS = 128;

const CSS = `
.pnm-over { position: fixed; left: 50%; bottom: max(8px, env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 26; width: min(920px, calc(100vw - 16px));
  max-height: calc(100vh - 16px); max-height: calc(100dvh - 16px); overflow-y: auto; overscroll-behavior: contain; }
.pnm-over[hidden] { display: none; }
body:has(.pnm-over:not([hidden])) .pnj-prompt { visibility: hidden; }
`;

export function startMusicPlaces({ W, walls, input = null, usable = null, game, boarding = null, mission = null, quiet = () => false }) {
  if (!document.getElementById('pnm-over-css')) { const st = document.createElement('style'); st.id = 'pnm-over-css'; st.textContent = CSS; document.head.appendChild(st); }
  const music = game.music, tap = tapOf(music);
  let picture = keptPicture(localStorage), lightsOn = hallwayOn(localStorage);

  // ── the picture: one canvas and texture for the 2D pictures, one material each for the shader pictures ──
  const cv = document.createElement('canvas'); cv.width = PAINT.w; cv.height = PAINT.h;
  const g = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  g.fillStyle = '#070b11'; g.fillRect(0, 0, PAINT.w, PAINT.h);
  // (a little over 1: lit from within, as the station's other screens read after its tone mapping)
  const flat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.3, 1.3, 1.3), toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  flat.name = 'music screens';
  const shaders = {}, memo = {};
  let shaderFailed = false;
  // (a shader picture's material, made the first time it is shown: Electric and Hex, src/music/electric.js, hex.js;
  // drawn as the room draws, behind what stands in front of it)
  const shaderMat = (id) => {
    if (shaders[id]) return shaders[id];
    const V = visualOf(id); if (!V.shader) return null;
    shaders[id] = { loading: true, m: null };
    const maker = import('./hex.js').then((m) => m.hexMaterial);
    maker.then((make) => {
      const m = make(THREE, { aspect: PAINT.w / PAINT.h, px: 1 / PAINT.h });
      // (the picture's own colours are the page's (display) colours; the station draws in linear light, tone-mapped
      // after: made linear here, the canvas pictures' way, so the two kinds of picture look alike on a wall)
      m.fragmentShader = m.fragmentShader.replace(/\}\s*$/, '  gl_FragColor.rgb = gl_FragColor.rgb * gl_FragColor.rgb * 1.3;\n}\n');
      m.depthTest = true; m.depthWrite = true; m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1; m.toneMapped = false;
      shaders[id] = { loading: false, m };
      apply();
    }, () => { shaderFailed = true; apply(); });
    return shaders[id];
  };
  const matNow = () => { const V = visualOf(picture); if (!V.shader || shaderFailed) return flat; const s = shaderMat(picture); return s && s.m ? s.m : flat; };
  let current = null;
  // (the face: the picture, and over it the strip with the word MUSIC, as the Music Lab's picture has it)
  const TH = MUSIC_FACE.h * TITLE.share, screens = [], faceGeo = new THREE.PlaneGeometry(MUSIC_FACE.w, MUSIC_FACE.h - TH).translate(0, -TH / 2, 0);
  const titleGeo = new THREE.PlaneGeometry(MUSIC_FACE.w, TH).translate(0, MUSIC_FACE.h / 2 - TH / 2, 0);
  const tcv = document.createElement('canvas'); tcv.width = 512; tcv.height = Math.round(512 * TH / MUSIC_FACE.w);
  { const tg = tcv.getContext('2d'), H = tcv.height; tg.fillStyle = '#0b1119'; tg.fillRect(0, 0, 512, H); tg.fillStyle = 'rgba(150,210,250,0.35)'; tg.fillRect(0, H - 2, 512, 2);
    tg.fillStyle = '#8fd3ff'; tg.font = `bold ${Math.round(H * 0.62)}px "DejaVu Sans", Arial, sans-serif`; tg.textAlign = 'center'; tg.textBaseline = 'middle';
    const word = TITLE.word.split('').join(String.fromCharCode(8202, 8202)); tg.fillText(word, 256, H * 0.52); }
  const titleTex = new THREE.CanvasTexture(tcv); titleTex.colorSpace = THREE.SRGBColorSpace; titleTex.anisotropy = 4;
  const titleMat = new THREE.MeshBasicMaterial({ map: titleTex, color: new THREE.Color(1.3, 1.3, 1.3), toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  function apply() { current = matNow(); for (const S of screens) S.mesh.material = current; }

  // ── the station's screens: each music screen piece, its face's picture in its room's own group ──
  const _m = new THREE.Matrix4(), faceAt = new THREE.Matrix4().makeTranslation(0, MUSIC_FACE.y, MUSIC_FACE.z + 0.0008);
  function addScreen({ id, room, song, world, holder, ship = null }) {
    holder.updateMatrixWorld(true);
    const mesh = new THREE.Mesh(faceGeo, current || matNow());
    mesh.name = 'music screen: ' + id; mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(_m.copy(holder.matrixWorld).invert().multiply(world)); mesh.matrixWorldNeedsUpdate = true;
    const title = new THREE.Mesh(titleGeo, titleMat); title.name = 'music screen title'; mesh.add(title);
    holder.add(mesh);
    if (input && input.addTarget) input.addTarget(mesh, { musicScreen: id });
    const S = { id, room, song, ship, mesh, holder, at: new THREE.Vector3(), out: new THREE.Vector3(), stand: new THREE.Vector3(), facing: 0 };
    screens.push(S); where(S);
    return S;
  }
  // (where a screen is now: its face's middle, the way it faces, the spot in front of it; a ship's moves with the ship)
  function where(S) {
    S.mesh.updateMatrixWorld(true);
    S.at.setFromMatrixPosition(S.mesh.matrixWorld); S.out.set(0, 0, 1).transformDirection(S.mesh.matrixWorld);
    S.stand.set(S.at.x + S.out.x * STAND.out, S.at.y, S.at.z + S.out.z * STAND.out);
    S.facing = Math.atan2(-S.out.x, -S.out.z);
  }
  for (const B of piecesOf(W.R).filter((x) => x.piece === 'screen' && x.variant === 'music')) {
    const zone = (W.room && W.room(B.room)) || W.zoneAt(new THREE.Vector3().setFromMatrixPosition(B.M));
    addScreen({ id: B.room, room: B.room, song: songOf(B.room), world: B.M.clone().multiply(faceAt), holder: zone ? zone.group : W.scene });
  }
  current = matNow(); for (const S of screens) S.mesh.material = current;
  // (aboard: a ship's cabin is built when it is come near and dropped after; its screen comes and goes with it)
  const cabinScreens = new Map();
  function cabinsNow() {
    if (!boarding || !boarding.cabins) return;
    const now = boarding.cabins(), ids = new Set(now.map((c) => c.id));
    for (const [id, S] of cabinScreens) if (!ids.has(id) || !S.holder.parent) { S.mesh.removeFromParent(); screens.splice(screens.indexOf(S), 1); cabinScreens.delete(id); }
    for (const c of now) {
      if (cabinScreens.has(c.id)) continue;
      const A = CABIN_MUSIC[c.bp]; if (!A) continue;
      const local = new THREE.Matrix4().makeRotationY(A.ry).setPosition(A.at[0], c.deck + A.at[1], A.at[2]).multiply(new THREE.Matrix4().makeTranslation(0, 0, MUSIC_SCREEN.depth + 0.0008));
      c.group.updateMatrixWorld(true);
      cabinScreens.set(c.id, addScreen({ id: c.id, room: c.id + '/' + A.room, song: 'station', ship: c.id, world: c.group.matrixWorld.clone().multiply(local), holder: c.group }));
    }
  }
  cabinsNow();

  // ── the hallways' lines ──
  const table = new Float32Array(5 * LINE_COLS), bytes = new Uint8Array(LINE_COLS * 5 * 4);
  const lineTex = new THREE.DataTexture(bytes, LINE_COLS, 5, THREE.RGBAFormat, THREE.UnsignedByteType);
  lineTex.magFilter = THREE.LinearFilter; lineTex.minFilter = THREE.LinearFilter; lineTex.needsUpdate = true;
  const lineMat = new THREE.ShaderMaterial({
    uniforms: { uTable: { value: lineTex }, uCol: { value: PART_IDS.map((p) => { const n = parseInt(PART_COLOURS[p].slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255], m = Math.max(...c); return new THREE.Vector3(c[0] / m, c[1] / m, c[2] / m); }) },
      uRest: { value: LINE_LOOK.rest }, uWhite: { value: LINE_LOOK.white } },
    vertexShader: `attribute vec3 line; varying vec3 vL;
void main() { vL = line; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    // (src/music/lights.js lineColour: the colour at full strength times the light, a hint toward white at the very top;
    // the line's long edges a little softer)
    fragmentShader: `precision mediump float;
uniform sampler2D uTable; uniform vec3 uCol[5]; uniform float uRest, uWhite; varying vec3 vL;
void main() {
  float r = floor(vL.y + 0.5);
  vec3 c = r < 0.5 ? uCol[0] : r < 1.5 ? uCol[1] : r < 2.5 ? uCol[2] : r < 3.5 ? uCol[3] : uCol[4];
  float v = texture2D(uTable, vec2(vL.x, (r + 0.5) / 5.0)).r, w = uWhite * v * v;
  float lit = (v > 0.003 ? uRest + (1.0 - uRest) * v : 0.0) * (1.0 - 0.45 * smoothstep(0.6, 1.0, abs(vL.z)));
  // (the station draws in linear light, tone-mapped and bloomed after (src/station.js): the colour the lab shows, made
  // linear, and lifted where the note is so it glows past the bloom's threshold as the white strips do)
  vec3 shown = (c * (1.0 - w) + w) * lit;
  gl_FragColor = vec4(shown * shown * (1.4 + 6.0 * v * v), 1.0);
}`,
    toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  lineMat.name = 'music lines';
  const halls = [];
  {
    const byRoom = new Map();
    for (const B of piecesOf(W.R).filter((x) => x.piece === 'lines')) { if (!byRoom.has(B.room)) byRoom.set(B.room, []); byRoom.get(B.room).push(B); }
    const _a = new THREE.Vector3(), _b = new THREE.Vector3();
    for (const [room, list] of byRoom) {
      // (the hallway's line: its stretches' ends, along it from the low end)
      const ends = list.map((B) => { const L = parseFloat(B.variant) || 2; return [_a.set(-L / 2, 0, 0).applyMatrix4(B.M).clone(), _b.set(L / 2, 0, 0).applyMatrix4(B.M).clone()]; });
      const A = alongOf(ends.flat().map((v) => [v.x, v.z]));
      const zone = (W.room && W.room(room)) || W.zoneAt(ends[0][0]), holder = zone ? zone.group : W.scene;
      holder.updateMatrixWorld(true);
      const toHolder = new THREE.Matrix4().copy(holder.matrixWorld).invert(), pos = [], line = [], ix = [], v = new THREE.Vector3(), m = new THREE.Matrix4();
      list.forEach((B, i) => {
        const L = parseFloat(B.variant) || 2, [e0, e1] = ends[i], u0 = A.u(e0.x, e0.z), u1 = A.u(e1.x, e1.z);
        m.multiplyMatrices(toHolder, B.M);
        for (let r = 0; r < 5; r++) {
          const y = lineY(r), k = pos.length / 3, hh = MUSIC_LINES.line / 2;
          for (const [x, s] of [[-L / 2, -1], [L / 2, -1], [L / 2, 1], [-L / 2, 1]]) {
            v.set(x + (x < 0 ? 0.01 : -0.01), y + s * hh, MUSIC_LINES.out + MUSIC_LINES.depth + 0.0025).applyMatrix4(m); pos.push(v.x, v.y, v.z);
            line.push(x < 0 ? u0 : u1, r, s);
          }
          ix.push(k, k + 1, k + 2, k, k + 2, k + 3);
        }
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('line', new THREE.Float32BufferAttribute(line, 3)); geo.setIndex(ix);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, lineMat); mesh.name = 'music lines: ' + room; mesh.matrixAutoUpdate = false; mesh.renderOrder = 2; mesh.visible = lightsOn;
      holder.add(mesh);
      halls.push({ room, mesh, holder, axis: A.axis, lo: +A.lo.toFixed(2), hi: +A.hi.toFixed(2), stretches: list.length, hallway: HALLWAYS.includes(room) });
    }
  }
  function setLights(on) { lightsOn = !!on; keepHallway(localStorage, lightsOn); for (const H of halls) H.mesh.visible = lightsOn; }

  // ── the prompt near a screen, and the controls over the game ──
  const prompt = document.createElement('div');
  prompt.className = 'pjb-prompt pnm-prompt'; prompt.hidden = true;
  prompt.innerHTML = '<div class="pjb-pw"><b>Music</b><small></small></div><button type="button" class="pjb-open">Open<kbd>E</kbd></button>';
  document.body.appendChild(prompt);
  prompt.querySelector('.pjb-open').addEventListener('click', () => open());
  const over = document.createElement('div');
  over.className = 'pnm-over'; over.hidden = true; over.setAttribute('role', 'dialog'); over.setAttribute('aria-label', 'Music');
  document.body.appendChild(over);
  let isOpen = null, near = null, playing = false, wasInput = true, mounted = null, link = null;
  function open(S = near) {
    if (isOpen || !S || !playing || (mission && mission.busy)) return false;
    // (only the song of the screen's place, the one playing here: the arena's in the arena; one switched to and not
    // come in yet (it starts on the next bar) is brought in now, so a change is made to it)
    if (S.song !== game.which) return false;
    if (!game.settled) game.settle();
    isOpen = S; over.hidden = false; prompt.hidden = true;
    if (input) { wasInput = input.enabled; input.enabled = false; }
    link = screenLink({ picture });
    link.fans.add((L) => {
      if (L.picture !== picture) { picture = L.picture; keepPicture(localStorage, picture); apply(); paintedAt = -1; }
    });
    mounted = mountMusicControls(over, music, { keep: '', link, play: false, hallway: { on: () => lightsOn, set: setLights }, onSong: (s) => game.edit(s), done: () => close() });
    addEventListener('keydown', onKey, true);
    return true;
  }
  function close() {
    if (!isOpen) return;
    isOpen = null; over.hidden = true;
    removeEventListener('keydown', onKey, true);
    const m = mounted; mounted = null; link = null;
    if (m) setTimeout(() => m.destroy(), 0);   // (not from inside its own click)
    if (input) input.enabled = wasInput;
  }
  function onKey(e) { if (isOpen && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } }
  addEventListener('keydown', (e) => {
    if (!playing || isOpen) return;
    if (near && !prompt.hidden && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); e.stopImmediatePropagation(); open(); }
  }, true);
  // (a mouse: while a screen is near enough to use, the pointer over it is a hand and a click opens its controls, as
  // E does: the game's one helper for everything that can be used, src/usable.js; a tap is the prompt's button)
  if (usable) usable.add({ name: 'music screen', ready: () => !!(near && !prompt.hidden && !isOpen && playing), shape: () => (near ? near.mesh : null), use: () => open(near) });

  // ── each frame ──
  const _d = new THREE.Vector3(), _c = new THREE.Vector3(), frus = new THREE.Frustum(), _pm = new THREE.Matrix4(), _s = new THREE.Sphere();
  let t = 0, paintedAt = -1, stats = { paints: 0, ms: 0, inView: 0, lines: 0, linesMs: 0, errors: 0, error: '' };
  // (a screen that can be seen: its room drawn, near enough, in front of the camera and facing it)
  const shown = (o) => { for (let p = o; p; p = p.parent) { if (!p.visible) return false; if (p === W.scene) return true; } return false; };
  const inView = (S) => {
    if (!shown(S.mesh)) return false;
    const cam = W.camera.position, d = S.at.distanceTo(cam);
    if (d > PAINT.far || _c.copy(cam).sub(S.at).dot(S.out) <= 0) return false;
    return frus.intersectsSphere(_s.set(S.at, 0.3));
  };
  const api = {
    screens, halls,
    update(dt, P, isPlaying = true) {
      t += dt;
      playing = isPlaying && !!P;
      if (Math.floor((t - dt) * 2) !== Math.floor(t * 2)) cabinsNow();   // (twice a second: a cabin come or gone)
      for (const S of screens) if (S.ship) where(S);
      W.camera.updateMatrixWorld(); frus.setFromProjectionMatrix(_pm.multiplyMatrices(W.camera.projectionMatrix, W.camera.matrixWorldInverse));
      let seen = 0, nearest = null, nd = Infinity;
      for (const S of screens) if (inView(S)) { seen++; const d = S.at.distanceTo(W.camera.position); if (d < nd) { nd = d; nearest = S; } }
      stats.inView = seen;
      let f = null;
      // the picture, PAINT.fps times a second while a screen is in view
      if (seen && (paintedAt < 0 || t - paintedAt >= 1 / PAINT.fps - 1e-4)) {
        paintedAt = t;
        const t0 = performance.now();
        try {
          f = tap.frame();
          const V = visualOf(picture);
          if (current !== flat && current && current.userData.state) {
            // (the screen's height on the page, for the shader's fine lines)
            const px = Math.max(24, (MUSIC_FACE.h / Math.max(0.3, nd)) / (2 * Math.tan(THREE.MathUtils.degToRad(W.camera.fov) / 2)) * innerHeight * Math.min(2, devicePixelRatio || 1));
            electricUniforms(f, current.userData.state, { time: t % 1000, aspect: PAINT.w / PAINT.h, px: 1 / px });
          } else {
            f.w = PAINT.w; f.h = PAINT.h; f.memo = memo[V.id] || (memo[V.id] = {});
            V.paint(g, f); tex.needsUpdate = true;
          }
          stats.paints++;
        } catch (e) { stats.errors++; stats.error = String(e && e.message || e); }
        stats.ms = performance.now() - t0;
      }
      // the lines: every frame a hallway with them is drawn
      if (lightsOn) {
        let any = false; for (const H of halls) if (shown(H.mesh)) { any = true; break; }
        if (any) {
          const t0 = performance.now();
          lightLines(f || tap.frame(), LINE_COLS, table);
          for (let r = 0; r < 5; r++) for (let i = 0; i < LINE_COLS; i++) bytes[(r * LINE_COLS + i) * 4] = Math.round(table[r * LINE_COLS + i] * 255);
          lineTex.needsUpdate = true; stats.lines++; stats.linesMs = performance.now() - t0;
        }
      }
      // near a screen: the prompt
      if (!playing) { if (isOpen) close(); prompt.hidden = true; near = null; return; }
      W.camera.getWorldDirection(_d); _d.y = 0; _d.normalize();
      near = null; let best = Infinity;
      for (const S of screens) {
        const dx = S.at.x - P.pos.x, dz = S.at.z - P.pos.z, d = Math.hypot(S.stand.x - P.pos.x, S.stand.z - P.pos.z);
        if (d > STAND.near || Math.abs(P.pos.y + 1.35 - S.at.y) > 1.6 || d >= best) continue;
        if (d < 0.8 || (_d.x * dx + _d.z * dz) / (Math.hypot(dx, dz) || 1) > STAND.facing) { near = S; best = d; }
      }
      if (near) prompt.querySelector('small').textContent = near.song === 'arena' ? 'Change the arena\'s song' : 'Change the station\'s song';
      prompt.hidden = !near || !!isOpen || !!quiet() || !!(mission && mission.busy) || near.song !== game.which;
    },
    open: (i) => open(typeof i === 'number' ? screens[i] : typeof i === 'string' ? screens.find((S) => S.id === i) : near),
    close,
    setLights, setPicture: (id) => { picture = visualOf(id).id; keepPicture(localStorage, picture); apply(); paintedAt = -1; },
    get isOpen() { return !!isOpen; },
    state: () => ({ open: isOpen ? isOpen.id : null, near: near ? near.id : null, prompt: !prompt.hidden, picture, lights: lightsOn, which: game.which, settled: game.settled,
      material: current ? current.name : null, stats: { ...stats }, screens: screens.map((S) => ({ id: S.id, room: S.room, song: S.song, ship: S.ship, at: S.at.toArray().map((v) => +v.toFixed(2)), stand: S.stand.toArray().map((v) => +v.toFixed(2)), facing: +S.facing.toFixed(3), inView: inView(S) })),
      halls: halls.map((H) => { const b = H.mesh.geometry.boundingSphere.center.clone().applyMatrix4(H.mesh.matrixWorld); return { room: H.room, axis: H.axis, lo: H.lo, hi: H.hi, stretches: H.stretches, shown: shown(H.mesh), mid: b.toArray().map((v) => +v.toFixed(2)) }; }), places: SCREEN_ROOMS }),
    table: () => table,
  };
  return api;
}
