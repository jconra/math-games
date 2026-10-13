// THE WINDMILL TOWER LAB: build a windmill tower as high as a stack of lumber allows, then call the wind and see how
// much of it stands. A Bandit Math prototype page, standing on its own (it changes nothing in the game; it reads the
// game's fonts, ground textures, trees and townsfolk).
//
// How a round goes: cut boards on the left, drag the pieces up onto the tower (front wall and side wall; the back and
// far side mirror them, or build all four), nail them. Now and then the miller asks about a triangle you just made; a
// right answer earns an extra board. Call the wind: a breeze, then growing gusts from every side. A real (simple) frame
// calculation decides what holds (frame.js). If something gives, the tower comes down; the miller pays flour for the
// height left standing, the yard is cleared and a fresh stack of lumber waits.
//
// Files: tower.js (the tower as data), frame.js (the physics), questions.js (the math), build.js (the panel and
// placing), tower3d.js (drawing the boards), fall.js (the crash), scene.js (the hilltop, wind, the miller), sound.js.
// window.WM is a handle for test scripts. ?perf shows frames per second.
import * as THREE from 'three';
import { W, BOARDS, newTower, faceSegments, faceToWorld, FACE_NORMAL, towerHeight, worldBoards, postSide, ends, faceWall, cornerList } from './tower.js';
import { windTest, whatStands, STAGES, findJoints, isKnee } from './frame.js';
import { trianglesOf, makeQuestion } from './questions.js';
import { makeScene, makeMiller, wind, FT, groundY } from './scene.js';
import { makeTowerView } from './tower3d.js';
import { makeFall } from './fall.js';
import { makeBuild, fmt } from './build.js';
import * as sound from './sound.js';

const TARGET_FT = 16;          // a tower standing this tall after the wind earns the windmill head and its sails
const DEG = Math.PI / 180;
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const phone = matchMedia('(max-width: 700px)').matches || /Mobi|Android/i.test(navigator.userAgent);

const el = {
  view: $('view'), canvas: $('c'), overlay: $('overlay'),
  count: $('count'), countWord: $('count-word'), bench: $('bench'), benchEmpty: $('bench-empty'), benchBoard: $('bench-board'), benchLabel: $('bench-label'),
  tape: $('tape'), saw: $('saw'), sawLabel: $('saw-label'), cutBtn: $('cut'), pieces: $('pieces'), piecesEmpty: $('pieces-empty'),
  gMove: $('g-move'), gA: $('g-a'), gB: $('g-b'), heldBar: $('held-bar'), heldHint: $('held-hint'), nailBtn: $('nail'), turnBtn: $('turn'), backBtn: $('back'),
  selBar: $('sel-bar'), selHint: $('sel-hint'),
};

// ── the renderer, camera, world ─────────────────────────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas: el.canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 2000);   // (narrow, so the wall in front reads flat and square)
const world = makeScene({ low: phone });
const { scene } = world;
const towerView = makeTowerView(scene);
const fall = makeFall(scene);

const app = {
  el, tower: newTower('mirror'), face: 0, phase: 'build', held: null, selected: null, dirty: true, autoScroll: 0,
  lumber: { stack: BOARDS, bench: null, pieces: [] }, placed: [],
};
let miller = null;
let best = 0; try { best = +(JSON.parse(localStorage.getItem('bm-windmill-best') || '{}').height || 0); } catch (e) { best = 0; }

// ── the camera: square on the wall being built, looking up and down it; round the side for the wind test ───────────
const cam = { az: 0, azT: 0, y: 6, yT: 6, mode: 'face', pos: new THREE.Vector3(0, 3, 14), look: new THREE.Vector3(0, 2, 0), d: 10 };
const azOf = (k) => Math.atan2(FACE_NORMAL[k][0], FACE_NORMAL[k][1]);
function fitDistance() {
  const r = el.view.getBoundingClientRect(), aspect = r.width / Math.max(1, r.height), t = Math.tan(camera.fov / 2 * DEG);
  const hw = (W / 2 + 2.6) * FT, hh = 8 * FT;
  return Math.max(hw / (t * aspect), hh / t) + W / 2 * FT;
}
function resize() {
  const r = el.view.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height);
  // a tall narrow screen (a phone held upright) gets a wider lens, or the tower would be a speck
  camera.fov = camera.aspect < 0.6 ? 46 : camera.aspect < 1 ? 36 : 30; camera.updateProjectionMatrix();
  cam.d = fitDistance(); build && build.renderPanel(); app.dirty = true;
}
function updateCamera(dt) {
  if (app.autoScroll) cam.yT = Math.max(5, Math.min(towerHeight(app.tower) + 12, cam.yT + app.autoScroll * 10 * dt));
  cam.az += angDiff(cam.azT, cam.az) * Math.min(1, dt * 7);
  cam.y += (cam.yT - cam.y) * Math.min(1, dt * 6);
  const want = new THREE.Vector3(), look = new THREE.Vector3();
  let rate = 9;
  if (cam.mode === 'face') {
    const ly = cam.y * FT; look.set(0, ly, 0);
    want.set(Math.sin(cam.az) * cam.d, ly + 0.35, Math.cos(cam.az) * cam.d);
  } else if (cam.mode === 'test') {
    // (once it is coming down, closer in, on the pile)
    const H = (test && test.crashing && fall.time > 0.8 ? 9 : Math.max(8, towerHeight(app.tower) || 8)) * FT, t = Math.tan(camera.fov / 2 * DEG), aspect = camera.aspect;
    const narrow = aspect < 0.6;
    const d = Math.max((H / 2 + 1.5) / t, (W * FT + (narrow ? 1.2 : 5)) / (t * aspect)) * (narrow ? 1 : 1.1) + 2;
    // (on a phone the result card covers the lower half: look lower so the tower sits up top)
    const ly = H * 0.45 - (narrow && app.phase === 'result' ? d * t * 0.45 : 0);
    const a = cam.testAz; look.set(0, ly, 0); want.set(Math.sin(a) * d, H * 0.45 + 1.5, Math.cos(a) * d); rate = 2.2;
  } else if (cam.mode === 'miller' && miller) {
    const p = miller.root.position, f = new THREE.Vector3(Math.sin(miller.root.rotation.y), 0, Math.cos(miller.root.rotation.y));
    look.set(p.x, p.y + 1.35, p.z); want.copy(look).addScaledVector(f, 4.2).add(new THREE.Vector3(0, 0.25, 0)); rate = 3;
  }
  cam.pos.lerp(want, Math.min(1, dt * rate)); cam.look.lerp(look, Math.min(1, dt * rate));
  camera.position.copy(cam.pos); camera.lookAt(cam.look);
  // a big gust shoves the watcher too: a small shake
  if (wind.level > 0.5 && cam.mode === 'test') { const k = (wind.level - 0.5) * 0.04, t = performance.now() / 1000; camera.position.x += Math.sin(t * 23) * k; camera.position.y += Math.sin(t * 31 + 1) * k * 0.6; }
  // keep the camera above the hill
  const gy = groundY(camera.position.x, camera.position.z) + 0.4; if (camera.position.y < gy) camera.position.y = gy;
}
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// wall coordinates (feet on face k) <-> the screen (pixels inside the view)
const v3 = new THREE.Vector3();
app.toScreen = (k, x, y) => {
  const w = faceToWorld(k, x, y), n = FACE_NORMAL[k];
  v3.set(w.X * FT + n[0] * 0.06, w.Y * FT, w.Z * FT + n[1] * 0.06).project(camera);
  const r = el.view.getBoundingClientRect();
  return { x: (v3.x + 1) / 2 * r.width, y: (1 - v3.y) / 2 * r.height };
};
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
app.toWall = (cx, cy) => {
  const r = el.view.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const k = app.face, n = FACE_NORMAL[k], N = new THREE.Vector3(n[0], 0, n[1]);
  const plane = new THREE.Plane(N, -(W / 2 * FT + 0.06)), hit = new THREE.Vector3();
  if (!ray.ray.intersectPlane(plane, hit)) return null;
  const o = faceToWorld(k, 0, 0), t = [[1, 0], [0, -1], [-1, 0], [0, 1]][k];
  return { x: ((hit.x - o.X * FT) * t[0] + (hit.z - o.Z * FT) * t[1]) / FT, y: hit.y / FT };
};
app.pxToFt = (px) => { const a = app.toWall(innerWidth / 2, innerHeight / 2), b = app.toWall(innerWidth / 2 + px, innerHeight / 2); return a && b ? Math.abs(b.x - a.x) : 0.5; };

// ── the walls: names, going round ───────────────────────────────────────────────────────────────────────────────────
const FACE_NAMES = { mirror: [['Front wall', 'the back mirrors it'], ['Side wall', 'the far side mirrors it'], ['Back wall', 'a mirror of the front'], ['Far side', 'a mirror of the side']],
  four: [['Front wall', 'built on its own'], ['Right side', 'built on its own'], ['Back wall', 'built on its own'], ['Left side', 'built on its own']] };
function showFaceName() { const [a, b] = FACE_NAMES[app.tower.mode][app.face]; $('face-name').textContent = a; $('face-sub').textContent = b; }
app.turn = (dir) => {
  app.face = (app.face + dir + 4) % 4; cam.azT = cam.azT + dir * Math.PI / 2;
  showFaceName(); app.select(null); app.dirty = true; walkMiller();
};
$('prev').onclick = () => app.phase === 'build' && app.turn(-1);
$('next').onclick = () => app.phase === 'build' && app.turn(1);
$('up').onclick = () => { cam.yT = Math.min(towerHeight(app.tower) + 12, cam.yT + 4); };
$('down').onclick = () => { cam.yT = Math.max(5, cam.yT - 4); };
el.view.addEventListener('wheel', (e) => { if (app.phase === 'build') { cam.yT = Math.max(5, Math.min(towerHeight(app.tower) + 12, cam.yT - e.deltaY * 0.01)); e.preventDefault(); } }, { passive: false });

// ── the panel ────────────────────────────────────────────────────────────────────────────────────────────────────────
const build = makeBuild(app);
app.onLumber = (n) => { world.setPile(n); };

// ── nailing, picking up, undo ────────────────────────────────────────────────────────────────────────────────────────
let idN = 1;
app.nail = () => {
  const h = app.held; if (!h) return;
  const k = app.face, side = postSide(h), t = app.tower;
  let rec;
  if (side !== null) {
    // a corner post: it belongs to the corner (both walls that meet there)
    const c = side === 0 ? k : (k + 1) % 4, e = ends(h);
    rec = { id: 'p' + idN++, y: Math.min(e.ay, e.by), len: h.len };
    cornerList(t, c).push(rec);
  } else {
    const { wall, flip } = faceWall(t, k);
    rec = flip ? { id: 'b' + idN++, x: W - h.x, y: h.y, ang: Math.PI - h.ang, len: h.len } : { id: 'b' + idN++, x: h.x, y: h.y, ang: h.ang, len: h.len };
    rec.ang = Math.atan2(Math.sin(rec.ang), Math.cos(rec.ang));
    t.walls[wall].push(rec);
  }
  app.placed.push({ rec, face: k });
  // a board touching at two places gets two nails
  const nails = build.contactsOf(h).length >= 2 ? 2 : 1;
  app.held = null; sound.hammer(nails);
  rebuild();
  // keep the top of the work in view
  const top = Math.max(h.y, h.y + Math.sin(h.ang) * h.len);
  if (top > cam.yT + 4) cam.yT = top - 2;
  afterNail(rec, k, side !== null);
};
app.select = (src) => {
  app.selected = src; towerView.highlight(src);
  el.selBar.hidden = !src || app.phase !== 'build';
  if (src) $('sel-hint').textContent = (src.ang === undefined ? 'Corner post' : 'Board') + ', ' + fmt(src.len);
};
app.pickAt = (cx, cy) => {
  if (app.phase !== 'build') return;
  const r = el.view.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(towerView.meshes(), false)[0];
  app.select(hit ? hit.object.userData.src : null);
};
$('leave').onclick = () => app.select(null);
$('pickup').onclick = () => { if (app.selected) pickUp(app.selected); };
$('undo').onclick = () => { if (app.phase !== 'build') return; if (app.held) { build.putBack(); return; } const last = app.placed[app.placed.length - 1]; if (last) pickUp(last.rec); };
// take a board down (it goes back to the cut pieces); anything left with nothing holding it up comes down too
function pickUp(src) {
  const t = app.tower, back = [];
  const drop = (rec) => {
    for (const w of t.walls) { const i = w.indexOf(rec); if (i >= 0) { w.splice(i, 1); back.push(rec.len); } }
    for (const c of t.corners) { const i = c.indexOf(rec); if (i >= 0) { c.splice(i, 1); back.push(rec.len); } }
    app.placed = app.placed.filter((p) => p.rec !== rec);
  };
  drop(src);
  // what still reaches the ground through its joints
  for (let guard = 0; guard < 50; guard++) {
    const held = new Set(), links = new Map(), link = (a, b) => { (links.get(a) || links.set(a, new Set()).get(a)).add(b); (links.get(b) || links.set(b, new Set()).get(b)).add(a); };
    for (let k = 0; k < 4; k++) {
      const segs = faceSegments(t, k);
      for (const h of findJoints(segs)) { const ids = h.items.map((it) => segs[it.s].src); if (h.ground) ids.forEach((s) => held.add(s)); for (let i = 1; i < ids.length; i++) link(ids[0], ids[i]); }
    }
    const reach = new Set(held), stack = [...held];
    while (stack.length) { const s = stack.pop(); for (const o of links.get(s) || []) if (!reach.has(o)) { reach.add(o); stack.push(o); } }
    const loose = [...t.walls.flat(), ...t.corners.flat()].filter((r) => !reach.has(r));
    if (!loose.length) break;
    loose.forEach(drop);
  }
  for (const len of back) build.returnPiece(len);
  sound.clatter(back[0] || 4, 'set'); app.select(null); rebuild();
}

function rebuild() {
  towerView.rebuild(app.tower); towerView.nails.visible = true; towerView.highlight(app.selected); towerView.showHead(false);
  const h = towerHeight(app.tower);
  $('height').textContent = fmt(h).replace(' ft', '') + ' ft';
  $('best').textContent = fmt(best).replace(' ft', '') + ' ft';
  app.dirty = true;
}

// ── the miller's advice: friendly, now and then, never twice in a row the same ───────────────────────────────────
const said = {}; let sayTimer = null, lastSay = 0;
function say(text, { key = text, times = 2, force = false, ms = 7000 } = {}) {
  const now = performance.now();
  if (!force && ((said[key] || 0) >= times || now - lastSay < 5000)) return false;
  said[key] = (said[key] || 0) + 1; lastSay = now;
  $('say-text').textContent = text; $('say').hidden = false;
  clearTimeout(sayTimer); sayTimer = setTimeout(() => { $('say').hidden = true; }, ms);
  gesture('Interact');
  return true;
}
// a one-off move (a wave, a point), then back to standing easy
let gestureTimer = null;
function gesture(name, ms = 1700) {
  if (!miller || miller.walking) return false;
  const ok = miller.play(name, { once: true, fade: 0.2 });
  clearTimeout(gestureTimer); gestureTimer = setTimeout(() => { if (miller && !miller.walking) miller.play('Idle', { fade: 0.4 }); }, ms);
  return ok;
}
function hasDiagonal(segs) { return segs.some((s) => !s.post && Math.abs(Math.abs(Math.atan2(s.by - s.ay, s.bx - s.ax)) % Math.PI - Math.PI / 2) < 1.35 && !isLevel(s) && !isUpright(s)); }
const angDeg = (s) => { let a = Math.abs(Math.atan2(s.by - s.ay, s.bx - s.ax)) / DEG; if (a > 90) a = 180 - a; return a; };
const isLevel = (s) => angDeg(s) < 3, isUpright = (s) => angDeg(s) > 87;

let sinceQuestion = 3, questionsAsked = 0;
function afterNail(rec, k, isPost) {
  const segs = faceSegments(app.tower, k), me = segs.find((s) => s.src === rec);
  const n = app.placed.length, H = towerHeight(app.tower);
  // a question about a triangle this board just made?
  sinceQuestion++;
  if (me && !isPost) {
    const tris = trianglesOf(segs, me.id);
    const chance = questionsAsked === 0 ? 0.7 : sinceQuestion >= 5 ? 0.9 : 0.35;
    const forced = params.has('askall');
    if (tris.length && sinceQuestion >= 2 && (forced || Math.random() < chance)) {
      const q = makeQuestion(tris, me);
      if (q) { setTimeout(() => ask(q), 450); sinceQuestion = 0; questionsAsked++; return; }
    }
  }
  // otherwise, maybe a word from the miller
  if (n === 1) { if (isPost) say('Good: a post on the corner, straight up. A post wants to be plumb, 90 degrees.', { force: true }); else say('Start with the corner posts, standing straight up. A post wants to be plumb, 90 degrees.', { force: true }); return; }
  if (!me) return;
  const a = angDeg(me);
  if (!isPost && a > 70 && a < 87) { say('That one leans. A post wants to be plumb, 90 degrees, or the weight pushes it over.', { key: 'plumb' }); return; }
  if (!isLevel(me) && !isUpright(me)) {
    if (isKnee(me)) { say('A knee brace helps some, but its nails take a beating in a big gust. A long brace corner to corner holds better.', { key: 'knee' }); return; }
    if (a < 30 || a > 60) { say(`That brace is at ${Math.round(a)} degrees. Brace it nearer 45 and she'll hold.`, { key: 'steep' }); return; }
    say('Brace it at 45 and she\'ll hold. A triangle can\'t fold.', { key: 'good45', times: 1 });
    const other = faceSegments(app.tower, (k + 1) % 4);
    if (!hasDiagonal(other)) setTimeout(() => say('Wind blows from every side. That other wall needs its own brace too.', { key: 'other' }), 5200);
    return;
  }
  if (isLevel(me) && !hasDiagonal(segs) && segs.filter((s) => s.post).length >= 2) { say('A square with no brace folds over like a card table in the wind.', { key: 'card', times: 2 }); return; }
  if (H >= 16 && !said.h16) { said.h16 = 1; say('Sixteen feet! Taller than my mill roof.', { key: 'h16', force: true }); return; }
  if (build && app.lumber.stack === 0 && !app.lumber.bench && app.lumber.pieces.length <= 1) say('That\'s the last of the lumber. Call the wind when you\'re ready.', { key: 'last', times: 1 });
}

// ── a math question card ─────────────────────────────────────────────────────────────────────────────────────────────
function ask(q) {
  if (app.phase !== 'build') return;
  app.phase = 'question';
  const card = $('question');
  card.innerHTML = `<h2>A triangle!</h2><div class="sub">Get it right and the miller adds a board to your stack.</div>
    ${trianglePic(q)}<p>${q.prompt}</p>
    <div class="choices">${q.choices.map((c) => `<button data-v="${c}">${c}${q.unit === '°' ? '°' : ''}</button>`).join('')}</div>
    <div class="why" hidden></div><div class="row" hidden><button class="btn go" id="q-ok">Back to building</button></div>`;
  card.hidden = false;
  gesture('Interact');
  card.querySelectorAll('.choices button').forEach((b) => b.onclick = () => {
    const v = +b.dataset.v, right = v === q.answer;
    card.querySelectorAll('.choices button').forEach((x) => { x.disabled = true; if (+x.dataset.v === q.answer) x.classList.add('is-right'); });
    const why = card.querySelector('.why'); why.hidden = false;
    if (right) {
      sound.chime(); why.innerHTML = `<b>Right!</b> ${q.why} The miller adds a fresh board to your stack.`;
      app.lumber.stack++; build.renderPanel();
      const f = $('flybonus'); f.hidden = false; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); setTimeout(() => { f.hidden = true; }, 1300);
    } else {
      b.classList.add('is-wrong'); sound.soft();
      why.innerHTML = `Not quite. ${q.why}${helperPic(q)}`;
    }
    card.querySelector('.row').hidden = false;
    card.querySelector('#q-ok').onclick = () => { card.hidden = true; app.phase = 'build'; };
  });
}
// the triangle itself, drawn from the wall, with what is known and the "?"
function trianglePic(q) {
  const pts = q.pts, xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const s = Math.min(240 / Math.max(0.1, maxX - minX), 130 / Math.max(0.1, maxY - minY));
  const P = pts.map((p) => ({ x: 40 + (p.x - minX) * s + (240 - (maxX - minX) * s) / 2, y: 160 - (p.y - minY) * s - (130 - (maxY - minY) * s) / 2 - 10 }));
  const cx = (P[0].x + P[1].x + P[2].x) / 3, cy = (P[0].y + P[1].y + P[2].y) / 3;
  let out = `<svg class="pic" viewBox="0 0 320 175"><polygon points="${P.map((p) => p.x + ',' + p.y).join(' ')}" fill="rgba(210,165,113,.35)" stroke="#6d4b2b" stroke-width="5" stroke-linejoin="round"/>`;
  // the sides' labels (side i runs from point i to point i+1), pushed outward from the middle
  q.sideLabels.forEach((l, i) => {
    if (!l) return; const a = P[i], b = P[(i + 1) % 3], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = mx - cx, dy = my - cy, d = Math.hypot(dx, dy) || 1;
    out += `<text x="${mx + dx / d * 20}" y="${my + dy / d * 20 + 6}" text-anchor="middle" font-family="Bitter, Georgia, serif" font-weight="700" font-size="18" fill="${l === '?' ? '#b0401f' : '#2b2219'}">${l}</text>`;
  });
  q.angleLabels.forEach((l, i) => {
    if (!l) return; const p = P[i], dx = cx - p.x, dy = cy - p.y, d = Math.hypot(dx, dy) || 1;
    out += `<text x="${p.x + dx / d * 30}" y="${p.y + dy / d * 30 + 6}" text-anchor="middle" font-family="Bitter, Georgia, serif" font-weight="700" font-size="17" fill="${l === '?' ? '#b0401f' : '#2b2219'}">${l}</text>`;
  });
  if (q.square !== undefined) {
    const p = P[q.square], a = P[(q.square + 1) % 3], b = P[(q.square + 2) % 3], ua = norm(a.x - p.x, a.y - p.y), ub = norm(b.x - p.x, b.y - p.y), r = 13;
    out += `<path d="M${p.x + ua.x * r} ${p.y + ua.y * r} L${p.x + ua.x * r + ub.x * r} ${p.y + ua.y * r + ub.y * r} L${p.x + ub.x * r} ${p.y + ub.y * r}" fill="none" stroke="#2b2219" stroke-width="2"/>`;
  }
  return out + '</svg>';
}
const norm = (x, y) => { const d = Math.hypot(x, y) || 1; return { x: x / d, y: y / d }; };
// a small picture that shows WHY: the three corners laid side by side make a straight line (180), or the squares on
// the sides of a right triangle
function helperPic(q) {
  if (q.helper.kind === 'angles') {
    const [a, b] = q.helper.shown, c = q.helper.answer, cx = 160, cy = 120, r = 90;
    const wedge = (from, to, col, label) => {
      const f = Math.PI - from * DEG, t = Math.PI - to * DEG, x1 = cx + Math.cos(f) * r, y1 = cy - Math.sin(f) * r, x2 = cx + Math.cos(t) * r, y2 = cy - Math.sin(t) * r;
      const m = (f + t) / 2, lx = cx + Math.cos(m) * r * 0.62, ly = cy - Math.sin(m) * r * 0.62 + 6;
      return `<path d="M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2} Z" fill="${col}" stroke="#2b2219" stroke-width="1.5"/><text x="${lx}" y="${ly}" text-anchor="middle" font-weight="700" font-size="15" font-family="Bitter, Georgia, serif">${label}°</text>`;
    };
    return `<svg class="pic" viewBox="0 0 320 140">${wedge(0, a, '#e9c98f', a)}${wedge(a, a + b, '#cfe0b0', b)}${wedge(a + b, 180, '#f0b9a3', c)}
      <line x1="40" y1="${cy}" x2="280" y2="${cy}" stroke="#2b2219" stroke-width="3"/><text x="160" y="138" text-anchor="middle" font-size="13" font-family="Bitter, Georgia, serif">the three corners together make a straight line: 180°</text></svg>`;
  }
  const { a, b, c } = q.helper, u = Math.min(20, 100 / c), mid = 120 - c * u / 2 + 6;
  const sq = (n, x, col) => { let g = `<rect x="${x}" y="${120 - n * u}" width="${n * u}" height="${n * u}" fill="${col}" stroke="#2b2219" stroke-width="1.5"/>`; for (let i = 1; i < n; i++) g += `<line x1="${x + i * u}" y1="${120 - n * u}" x2="${x + i * u}" y2="120" stroke="rgba(0,0,0,.15)"/><line x1="${x}" y1="${120 - i * u}" x2="${x + n * u}" y2="${120 - i * u}" stroke="rgba(0,0,0,.15)"/>`; return g + `<text x="${x + n * u / 2}" y="136" text-anchor="middle" font-weight="700" font-size="13" font-family="Bitter, Georgia, serif">${n}×${n}=${n * n}</text>`; };
  const x2 = 20 + a * u + 22, x3 = x2 + b * u + 34;
  return `<svg class="pic" viewBox="0 0 ${Math.max(320, x3 + c * u + 10)} 142">${sq(a, 20, '#e9c98f')}<text x="${20 + a * u + 11}" y="${mid}" text-anchor="middle" font-size="20" font-weight="700">+</text>${sq(b, x2, '#cfe0b0')}<text x="${x2 + b * u + 17}" y="${mid}" text-anchor="middle" font-size="20" font-weight="700">=</text>${sq(c, x3, '#f0b9a3')}</svg>`;
}

// ── the wind test ────────────────────────────────────────────────────────────────────────────────────────────────────
const COMPASS = { 'X1': 'from the west', 'X-1': 'from the east', 'Z1': 'from the north', 'Z-1': 'from the south' };
let test = null;      // { result, stands, i, t, case, sway, ... }
$('wind').onclick = () => startTest();
function startTest() {
  if (app.phase !== 'build') return;
  sound.audioOn();
  if (!towerHeight(app.tower)) { say('Put some boards up first! Corner posts make a good start.', { force: true }); return; }
  if (app.held) build.putBack();
  app.select(null);
  const result = windTest(app.tower), stands = whatStands(app.tower, result);
  test = { result, stands, i: 0, t: 0, crashing: false };
  app.phase = 'test'; cam.mode = 'test';
  // the watching spot: round the corner from the wall you were on, along one of the clear lines between the trees
  const wantAz = cam.az + 0.65, clear = [0.62, -0.55, 1.58];
  cam.testAz = clear.map((a) => a + Math.round((wantAz - a) / (Math.PI * 2)) * Math.PI * 2).sort((a, b) => Math.abs(a - wantAz) - Math.abs(b - wantAz))[0];
  $('say').hidden = true; $('wind').hidden = true; el.heldBar.hidden = true; el.selBar.hidden = true; $('stage').hidden = false;
  beginStage(0);
}
function caseOf(i) { const r = test.result; return i === r.failedAt ? r.fail : r.stages[i].worst; }
function beginStage(i) {
  test.i = i; test.t = 0;
  const st = STAGES[i], c = caseOf(i);
  test.case = c;
  wind.dir.set(c.axis === 'X' ? c.sign : 0, 0, c.axis === 'Z' ? c.sign : 0);
  $('stage-name').textContent = st.name; $('stage-sub').textContent = `${st.mph} mph ${COMPASS[c.axis + c.sign]}`;
  $('stage-bar').style.width = ((i + 1) / STAGES.length * 100) + '%';
  // the sway of each floor (feet, from the calculation), drawn larger so the eye can see it
  const levels = (c.levels || [{ y: 0, ux: 0 }]).map((l) => ({ y: l.y, d: Math.abs(l.ux) }));
  test.profile = levels;
}
function swayAt(y, gain) {
  const L = test.profile; let d = 0;
  if (L.length) {
    if (y <= L[0].y) d = L[0].d * (L[0].y > 0 ? y / L[0].y : 1);
    else if (y >= L[L.length - 1].y) d = L[L.length - 1].d;
    else for (let i = 1; i < L.length; i++) if (y <= L[i].y) { const u = (y - L[i - 1].y) / Math.max(0.01, L[i].y - L[i - 1].y); d = L[i - 1].d + (L[i].d - L[i - 1].d) * u; break; }
  }
  return new THREE.Vector3().copy(wind.dir).multiplyScalar(Math.min(0.9, d * 7 * FT) * gain);
}
function stepTest(dt) {
  test.t += dt;
  const st = STAGES[test.i], failing = test.i === test.result.failedAt;
  const D = 2.6, t = test.t;
  // the gust's shape: rising, a few surges, easing off (a failing stage keeps rising)
  const env = failing ? Math.min(1, t / 0.9) : Math.min(1, t / 0.8) * Math.min(1, Math.max(0, (D - t) / 0.6));
  const surge = 0.8 + 0.2 * Math.sin(t * 5.3) * Math.sin(t * 1.7 + 0.5);
  wind.level = (st.mph / 60) * env * surge;
  sound.setWind(wind.level);
  if (!test.crashing) {
    // past what it can hold: the lean grows until it lets go
    const extra = failing ? 1 + Math.max(0, t - 1.0) * Math.max(0, t - 1.0) * 14 : 1;
    const gain = env * surge * extra;
    towerView.setSway((y) => swayAt(y, gain));
    if (failing && t > 2.0) crash(gain);
    else if (!failing && t > D) {
      if (test.i + 1 < STAGES.length) beginStage(test.i + 1);
      else finishTest();
    }
  } else {
    const ev = fall.update(dt, wind.dir);
    soundEvents(ev);
    if (fall.settled() && !test.done) { test.done = true; setTimeout(finishTest, 400); }
  }
}
let lastCrack = 0, lastThud = 0;
function soundEvents(ev) {
  const now = performance.now();
  if (ev.pops && now - lastCrack > 70) { sound.crack(); lastCrack = now; }
  if (ev.hits && now - lastThud > 90) { sound.thud(ev.bigHit); lastThud = now; }
}
function crash(gain) {
  test.crashing = true;
  const fallen = new Set(worldBoards(app.tower).map((b) => b.key)), standing = new Set(worldBoards(test.stands.tower).map((b) => b.key));
  for (const k of standing) fallen.delete(k);
  const w = test.result.fail.worst, k = test.result.fail.face ?? 0;
  const breakAt = faceToWorld(k, w.x ?? W / 2, w.y || 0);
  const sway = (y) => swayAt(y, gain);
  towerView.setSway(null); towerView.nails.visible = false;
  fall.start({ tower: app.tower, view: towerView, falling: fallen, windDir: wind.dir.clone(), sway, breakAt });
  // the boards that stay up go back to standing straight
  sound.crash();
  gesture('HitRecieve', 1200);
}
function finishTest() {
  app.phase = 'result'; wind.level = 0.1; sound.setWind(0.1);
  $('stage').hidden = true;
  const r = test.result, h = test.stands.height, stood = r.failedAt < 0;
  if (stood) towerView.setSway(null);
  const sacks = flourFor(h);
  const newBest = h > best;
  if (newBest) { best = h; try { localStorage.setItem('bm-windmill-best', JSON.stringify({ height: best, at: Date.now() })); } catch (e) { /* storage blocked: the record lasts this visit */ } }
  $('best').textContent = fmt(best).replace(' ft', '') + ' ft';
  if (stood && h >= TARGET_FT) towerView.showHead(true, h, Math.atan2(camera.position.x, camera.position.z));   // (sails turned to face us)
  const st = r.failedAt >= 0 ? STAGES[r.failedAt] : null, c = r.fail;
  const title = stood ? (h >= TARGET_FT ? 'She stood! Sails up!' : 'She stood!') : h > 0 ? 'The top came down' : 'Down she came!';
  const why = stood ? 'Through the breeze and every gust, from all four sides.'
    : `In the ${st.name.toLowerCase()} (${st.mph} mph ${COMPASS[c.axis + c.sign]}), ${c.worst.text}.`;
  const advice = stood ? (h >= TARGET_FT ? 'Now that\'s a windmill. She\'ll grind flour all summer.' : `Good and stout. Reach ${TARGET_FT} feet and I'll put the sails on her.`)
    : c.worst.type === 'sway' && !/knee/.test(c.worst.text) ? 'No brace in that square, so it folded. Put a long brace corner to corner, near 45 degrees, in every wall.'
    : /knee/.test(c.worst.text) ? 'Knee braces help, but a long brace corner to corner holds better.'
    : /butt/.test(c.worst.text) ? 'Two boards end to end hardly hold. Nail a crosspiece or a brace over the joint.'
    : 'Something gave. Braces near 45 degrees spread the load best.';
  const card = $('result'); card.classList.add('is-side');
  card.innerHTML = `<h2>${title}</h2><p class="sub">${why}</p>
    <div class="stat"><div><small>Left standing</small><div class="big">${fmt(h)}</div></div><div><small>Best</small><div class="big">${fmt(best)}</div></div></div>
    <div class="sacks">${SACK}<div><b>The miller pays ${sacks} sack${sacks === 1 ? '' : 's'} of flour</b><br><small>${newBest && h > 0 ? 'A new best height!' : 'A sack for every foot left standing' + (h >= TARGET_FT ? ', and five more for the sails' : '')}</small></div></div>
    <p class="miller">"${advice}"</p>
    <div class="row">${stood ? '<button class="btn" id="r-fresh">Start fresh</button><button class="btn go" id="r-keep">Keep building</button>' : '<button class="btn go" id="r-again">Try again</button>'}</div>`;
  card.hidden = false;
  const again = $('r-again'), keep = $('r-keep'), fresh = $('r-fresh');
  if (again) again.onclick = () => { card.hidden = true; millerBeat(advice); };
  if (fresh) fresh.onclick = () => { card.hidden = true; millerBeat('Fresh lumber\'s on the sawhorses.'); };
  if (keep) keep.onclick = () => { card.hidden = true; backToBuild(); };
}
function flourFor(h) { return Math.floor(h + 1e-6) + (h >= TARGET_FT ? 5 : 0); }
const SACK = '<svg viewBox="0 0 32 32"><path d="M9 6c2 2 12 2 14 0l-1 4c4 3 6 9 5 15-1 4-5 5-11 5S6 29 5 25c-1-6 1-12 5-15z" fill="#efe6d0" stroke="#7a5530" stroke-width="1.5"/><path d="M10 10c3 1 9 1 12 0" stroke="#7a5530" stroke-width="1.5" fill="none"/><text x="16" y="23" text-anchor="middle" font-size="7" font-family="Smokum, Georgia, serif" fill="#7a5530">FLOUR</text></svg>';

// after a crash (or for a fresh start): the camera turns to the miller for a moment, the yard is cleared behind the
// camera's back, and a fresh stack of lumber waits
function millerBeat(line) {
  app.phase = 'miller'; cam.mode = 'miller';
  $('say-text').textContent = line; $('say').hidden = false; clearTimeout(sayTimer);
  gesture('Wave', 2000) || gesture('Interact');
  setTimeout(() => {
    fall.clear(towerView);
    resetAll(app.tower.mode);
  }, 700);
  setTimeout(() => { $('say').hidden = true; backToBuild(); }, 1900);
}
function backToBuild() {
  app.phase = 'build'; cam.mode = 'face'; cam.az = Math.atan2(cam.pos.x, cam.pos.z); towerView.showHead(false); towerView.setSway(null);
  $('wind').hidden = false; wind.level = 0.06; wind.dir.set(1, 0, 0.2).normalize(); test = null; app.dirty = true;
}
function resetAll(mode) {
  app.tower = newTower(mode); app.placed = []; app.held = null; app.selected = null;
  build.freshStack(mode === 'four' ? BOARDS * 2 : BOARDS);
  app.face = 0; cam.azT = Math.round(cam.az / (Math.PI * 2)) * Math.PI * 2; cam.yT = 6;
  showFaceName(); rebuild(); walkMiller(); sinceQuestion = 3;
}
$('mode').onclick = () => {
  if (app.phase !== 'build') return;
  const next = app.tower.mode === 'mirror' ? 'four' : 'mirror';
  const go = () => { resetAll(next); $('mode').textContent = next === 'mirror' ? 'Mirror walls' : 'All four walls'; say(next === 'four' ? 'All four walls on their own, then. Twice the lumber, twice the work.' : 'Back to two walls: the far ones mirror them.', { force: true }); };
  if (!towerHeight(app.tower)) { go(); return; }
  const card = $('result'); card.classList.remove('is-side');
  card.innerHTML = `<h2>Start over?</h2><p>${next === 'four' ? 'Build all four walls on their own (with twice the lumber)?' : 'Build two walls and mirror them?'} This takes the tower down.</p><div class="row"><button class="btn" id="m-no">Keep this tower</button><button class="btn go" id="m-yes">Start over</button></div>`;
  card.hidden = false; app.phase = 'confirm';
  $('m-no').onclick = () => { card.hidden = true; app.phase = 'build'; };
  $('m-yes').onclick = () => { card.hidden = true; app.phase = 'build'; go(); };
};

// ── the miller walks round to stand by whichever wall you are building ──────────────────────────────────────────────
let millerTarget = null;
function millerSpot(k) {
  const n = FACE_NORMAL[k], t = [[1, 0], [0, -1], [-1, 0], [0, 1]][k];
  return new THREE.Vector3(n[0] * 0.9 + t[0] * 2.3, 0, n[1] * 0.9 + t[1] * 2.3);
}
function walkMiller() { millerTarget = millerSpot(app.face); }
function updateMiller(dt) {
  if (!miller) return;
  const p = miller.root.position;
  if (millerTarget && p.distanceTo(millerTarget) > 0.08 && app.phase !== 'miller') {
    // round the tower (never through it): step along the circle toward the spot's angle
    const a0 = Math.atan2(p.x, p.z), a1 = Math.atan2(millerTarget.x, millerTarget.z), r0 = Math.hypot(p.x, p.z), r1 = Math.hypot(millerTarget.x, millerTarget.z);
    const da = angDiff(a1, a0), step = 1.4 * dt / Math.max(1, r0);
    const a = Math.abs(da) < step ? a1 : a0 + Math.sign(da) * step, r = r0 + Math.sign(r1 - r0) * Math.min(Math.abs(r1 - r0), 1.4 * dt);
    const nx = Math.sin(a) * r, nz = Math.cos(a) * r;
    miller.root.rotation.y = Math.atan2(nx - p.x, nz - p.z);
    p.set(nx, groundY(nx, nz), nz);
    if (!miller.walking) { miller.play('Walk', { fade: 0.2 }); miller.walking = true; }
    if (Math.abs(da) < 0.01 && Math.abs(r1 - r0) < 0.05) p.copy(millerTarget);
  } else {
    if (miller.walking) { miller.play('Idle', { fade: 0.3 }); miller.walking = false; }
    // face half toward the camera and half toward the tower
    const want = Math.atan2(camera.position.x - p.x, camera.position.z - p.z) * 0.5 + Math.atan2(-p.x, -p.z) * 0.5;
    miller.root.rotation.y += angDiff(want, miller.root.rotation.y) * Math.min(1, dt * 3);
  }
  miller.update(dt);
}

// ── the loop ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let frames = 0, fpsT = 0, fps = 0;
const perf = params.has('perf');
let ambient = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  if (app.phase === 'test' && test) stepTest(dt);
  else if (app.phase !== 'result') {
    // a light breeze while building, puffing now and then
    ambient += dt; wind.level = 0.07 + 0.05 * Math.max(0, Math.sin(ambient * 0.4)) ** 3;
    sound.setWind(wind.level);
  }
  if (app.phase === 'result' && fall.running) { const ev = fall.update(dt, wind.dir); soundEvents(ev); }
  world.update(dt, cam.look, camera.position);
  updateCamera(dt);
  updateMiller(dt);
  towerView.update(dt, wind.level);
  if (app.held && app.phase === 'build') towerView.showHeld(app.face, app.held.x, app.held.y, app.held.ang, app.held.len, postSide(app.held) !== null);
  else towerView.showHeld(null);
  build.frame();
  // the sun's shadow box follows the camera's target
  world.sun.position.set(cam.look.x - 0.55 * 40, 0.62 * 40, cam.look.z + 0.56 * 40); world.sun.target.position.copy(cam.look); world.sun.target.position.y = 0;
  renderer.render(scene, camera);
  frames++; fpsT += dt; if (fpsT > 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; if (perf) { $('perf').hidden = false; $('perf').textContent = `${fps.toFixed(0)} fps · ${renderer.info.render.calls} draws`; } }
}

// ── keys ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
addEventListener('keydown', (e) => {
  if (app.phase !== 'build') return;
  if (e.key === 'ArrowLeft') app.turn(-1);
  else if (e.key === 'ArrowRight') app.turn(1);
  else if (e.key === 'ArrowUp') cam.yT = Math.min(towerHeight(app.tower) + 12, cam.yT + 2);
  else if (e.key === 'ArrowDown') cam.yT = Math.max(5, cam.yT - 2);
  else if (e.key === 'Escape') { if (app.held) build.putBack(); else app.select(null); }
  else if (e.key === 'Enter' && app.held) el.nailBtn.click();
  else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) $('undo').click();
  else if (e.key === 'r' || e.key === 'R') el.turnBtn.click();
});
addEventListener('pointerdown', () => sound.audioOn(), { capture: true });
// the sound control in the top bar: tap the speaker to mute, slide for volume
{
  const btn = $('mute'), vol = $('vol');
  const show = () => { const v = sound.getVolume(); btn.classList.toggle('is-muted', v.muted || v.volume === 0); btn.setAttribute('aria-pressed', String(v.muted)); vol.value = Math.round(v.volume * 100); };
  btn.onclick = () => { const v = sound.getVolume(); sound.setVolume(v.volume || 0.8, !v.muted); show(); };
  vol.oninput = () => { sound.setVolume(vol.value / 100, false); show(); };
  vol.addEventListener('keydown', (e) => e.stopPropagation());   // (arrow keys move the slider, not the camera)
  show();
}

// ── start ────────────────────────────────────────────────────────────────────────────────────────────────────────────
addEventListener('resize', resize);
resize();
build.freshStack(BOARDS);
showFaceName(); rebuild();
cam.az = cam.azT = 0; cam.pos.set(0, 4, cam.d + 6);
loop();
world.treeLoad.then(() => { $('loading').classList.add('is-done'); });
setTimeout(() => $('loading').classList.add('is-done'), 6000);
makeMiller(scene).then((m) => {
  miller = m; miller.root.position.copy(millerSpot(0)); walkMiller();
  setTimeout(() => say('Howdy! Build me a windmill tower, tall as you can. Cut a board on the left and drag the pieces up onto the tower.', { force: true, ms: 9000 }), 900);
});

// ── a handle for test scripts ────────────────────────────────────────────────────────────────────────────────────────
// WM.add(face, x, y, angleDegrees, length) nails a board as if dragged there (same snapping, same questions)
window.WM = {
  app, camera, renderer, scene, wind, cam, test: () => test, build, startTest, towerView, fall,
  add(face, x, y, angDeg, len) {
    if (app.face !== face) { app.face = face; cam.azT = azOf(face) + Math.round((cam.azT - azOf(face)) / (Math.PI * 2)) * Math.PI * 2; showFaceName(); }
    app.held = { piece: { id: 'dev', len }, len, x, y, ang: angDeg * DEG }; app.nail();
  },
  state: () => ({ phase: app.phase, face: app.face, height: towerHeight(app.tower), boards: worldBoards(app.tower).length, lumber: { stack: app.lumber.stack, bench: app.lumber.bench && app.lumber.bench.len, pieces: app.lumber.pieces.map((p) => p.len) }, held: app.held && { x: app.held.x, y: app.held.y, ang: app.held.ang / DEG, len: app.held.len }, best, fps, question: !$('question').hidden ? $('question').innerText : null, result: !$('result').hidden ? $('result').innerText : null, falling: fall.sticks.length }),
  toScreen: (k, x, y) => { const p = app.toScreen(k, x, y), r = el.view.getBoundingClientRect(); return { x: p.x + r.left, y: p.y + r.top }; },
  resetAll, flourFor, STAGES,
};
