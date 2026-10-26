// THE TOWN LAB: the game's own valley and town (world/valley.js, the very modules the game draws them with) with the
// Terrain Lab's editing tools on (the Build bar: plantTool.js, its gizmo, the town editor), for decorating the town:
// moving and turning the buildings and props, putting down fences, barrels, crates, troughs, lanterns and gardens,
// painting flowers. What it makes is models/town/decor.json (decorfile.js writes it, world/objects/decor.js is how the
// game reads it): the changes from the shipped town only. Nothing of this page is in the game.
//   Save: served from this machine (127.0.0.1 or localhost), sent to the little save script
//   (~/pw/bandit-math/rigs/town/save_server.cjs, port 8998), which writes it into the game's folder; anywhere else (or
//   with the script not running) downloaded, to hand over. Open… reads one back; Back to saved goes back to the game's.
// The work in hand is also kept in this browser as it goes (the Build bar's own copy), so a reload doesn't lose it.
// For rigs: window.TL = { ready, V, tool, text(), savedText(), save(), open(decor), view(name), look(..), screen(x, y, z), camera, fps }
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeValley, TIER_SET } from '../../world/valley.js';
import { chooseTier } from '../../world/quality.js';
import { BASE } from '../../world/base.js';
import { VillageEditor } from '../../world/objects/villageEditor.js';
import { normalise as normaliseTown } from '../../world/objects/village.js';
import { normalisePlanting } from '../../world/objects/planting.js';
import { applyDecor } from '../../world/objects/decor.js';
import { PROP_KINDS } from '../../world/objects/townProps.js';
import { KIND_INFO } from '../../world/objects/growth.js';
import { BACKWOODS } from '../../src/missions/backwoods.js';
import { makeDecor, decorText } from './decorfile.js';

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const LOCAL = ['127.0.0.1', 'localhost'].includes(location.hostname);
const SAVE_URL = 'http://127.0.0.1:8998/decor';
const TL = window.TL = { ready: false, fps: 0 };
const say = (text, cls = '') => { const s = $('tlStatus'); s.textContent = text; s.className = 'tl-status' + (cls ? ' ' + cls : ''); };

// ── the renderer and camera, as the game makes them (src/main.js, src/world.js) ───────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: Q.get('q') !== 'potato', powerPreference: 'high-performance' });
const QUAL = chooseTier(renderer), TS = TIER_SET[QUAL.tier];
renderer.setPixelRatio(Math.min(devicePixelRatio, TS.ratio)); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
document.body.prepend(renderer.domElement);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 5000);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.495; controls.listenToKeyEvents(window);

// ── the town as shipped (what the decor is the difference from) and as last saved ────────────────────────────────
const getJSON = (f) => fetch(`${BASE}models/town/${f}.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const [LAYOUT_RAW, PLANTING_RAW, DECOR_RAW] = await Promise.all(['layout', 'planting', 'decor'].map(getJSON));
const SHIPPED = { layout: normaliseTown(LAYOUT_RAW), planting: normalisePlanting(PLANTING_RAW) };
const GAME = (LAYOUT_RAW && LAYOUT_RAW.game) || {};
// the strips kept clear of trees on the way into each back-woods camp, as the game asks for them (src/world.js campWays)
const treeClear = (() => { const sq = GAME.square || GAME.spawn; if (!sq) return [];
  return BACKWOODS.map((b) => { const dx = sq.x - b.x, dz = sq.z - b.z, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
    return { ax: b.x + ux * 3, az: b.z + uz * 3, bx: b.x + ux * 28, bz: b.z + uz * 28, half: 1.5 }; }); })();

// (the website's landmarks, which the western town doesn't use, left off this lab's palette: before the Build bar is made)
for (const k of ['valehexGlobe', 'stateMap', 'obelisk']) { const i = PROP_KINDS.findIndex((P) => P.kind === k); if (i >= 0 && !SHIPPED.layout.items.some((it) => it.kind === k)) PROP_KINDS.splice(i, 1); }
say('Laying the land…');
const V = await makeValley({ renderer, camera, controls, quality: QUAL, lab: true, slice: true, showcase: false, folk: false, look: Q.get('look') === 'summer' ? 'summer' : 'green', treeClear });
TL.V = V;
const { TOWN, PLANT, heightAt, groundAt } = V;
// the town editor the Build bar edits the town through (its history, the copy kept in this browser); after a change and
// a short pause only what it touched is laid again
let townTimer = 0;
const townRebuild = () => { clearTimeout(townTimer); townTimer = setTimeout(() => V.townRebuildNow(), 350); };
TOWN.editor = new VillageEditor({ village: TOWN.village, camera, controls, dom: renderer.domElement, container: document.createElement('div'), groundAt, scene: V.scene,
  roadCanvas: TOWN.canvas, roadChanged: (rect) => { V.composePathRoad(rect); V.paveLater(); }, changed: townRebuild, defaultLayout: V.TOWN_DEFAULT });

// ── the views ──────────────────────────────────────────────────────────────────────────────────────────────────
const SQ = GAME.square || { x: -12, z: -205 };
const at = (id) => (TOWN.village.item(id) || SQ);
const look = (cx, cy, cz, tx, tz, ty = 1) => { camera.position.set(cx, heightAt(cx, cz) + cy, cz); controls.target.set(tx, heightAt(tx, tz) + ty, tz); controls.update(); };
const VIEWS = {
  'The square': () => look(SQ.x - 34, 24, SQ.z - 34, SQ.x + 4, SQ.z + 6),
  'Overhead': () => look(SQ.x, 110, SQ.z + 0.1, SQ.x, SQ.z),
  'The cabin': () => { const c = at('cabin'); look(c.x - 22, 14, c.z - 14, c.x, c.z); },
  'The homes': () => { const h = at('home2'); look(h.x - 30, 22, h.z - 26, h.x - 10, h.z + 6); },
  'Down the street': () => look(SQ.x - 14, 2.2, SQ.z - 10, SQ.x + 20, SQ.z + 22, 1.6),
};
for (const [name, f] of Object.entries(VIEWS)) { const b = document.createElement('button'); b.type = 'button'; b.textContent = name; b.onclick = f; $('tlViews').appendChild(b); }
TL.view = (n) => VIEWS[n] && VIEWS[n]();
TL.look = look; TL.camera = camera; TL.renderer = renderer;
TL.screen = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera), r = renderer.domElement.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, behind: v.z > 1 }; };   // (rigs: where a spot is on screen)
VIEWS['The square']();

// ── the frame loop ─────────────────────────────────────────────────────────────────────────────────────────────
const fit = () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); renderer.getDrawingBufferSize(V.U.res.value); };
addEventListener('resize', fit); fit();
let last = performance.now(), frames = 0, fpsT = last;
renderer.info.autoReset = false;
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now; frames++;
  renderer.info.reset();
  V.update(dt, () => controls.update());
  if (PLANT.tool) PLANT.tool.update();
  V.render();
  if (now - fpsT > 500) { TL.fps = frames * 1000 / (now - fpsT); frames = 0; fpsT = now; const i = renderer.info.render;
    $('tlHud').textContent = `${QUAL.tier} · ${TL.fps.toFixed(0)} fps · ${i.calls} draws`; }
});
$('tlLoading').textContent = 'Growing the plants…';
while (!PLANT.tool || !V.settled()) await new Promise((r) => setTimeout(r, 200));
$('tlLoading').hidden = true;
const tool = PLANT.tool, bar = tool.bar;
TL.tool = tool;

// ── the decor: what's changed from the shipped town ─────────────────────────────────────────────────────────────
const plain = (n) => String(n || '').replace(/\s*\(.*\)\s*$/, '').trim();
const nameOf = (o) => { const k = tool.kindOf(o.kind); const n = plain(k.name); if (!n) return ''; return o.mode === 'clear' ? (n === 'fence' ? 'fence taken down' : 'cleared') : n; };
const nowTown = () => ({ layout: TOWN.village.layout, planting: tool.planting });
const textOf = (town) => decorText(makeDecor(SHIPPED, town, nameOf));
const appliedOf = (decor) => { const D = applyDecor(LAYOUT_RAW, PLANTING_RAW, decor); return { layout: normaliseTown(D.layout), planting: normalisePlanting(D.planting) }; };
let SAVED = textOf(appliedOf(DECOR_RAW));
TL.text = () => textOf(nowTown()); TL.savedText = () => SAVED;
const showState = () => {
  const t = TL.text(), d = makeDecor(SHIPPED, nowTown()), n = Object.keys(d.moved || {}).length + (d.placed || []).length + (d.removed || []).length + ((d.planting && d.planting.strokes) || []).length + ((d.planting && d.planting.items) || []).length;
  if (t !== SAVED) say(`Unsaved changes · ${n} thing${n === 1 ? '' : 's'} changed from the shipped town`, 'unsaved');
  else if (!$('tlStatus').classList.contains('saved')) say(n ? `Saved · ${n} thing${n === 1 ? '' : 's'} changed from the shipped town` : 'Nothing changed yet: the town as shipped');
};
setInterval(showState, 1000);
if (TL.text() !== SAVED) say('This browser kept changes from last time that aren\'t saved (Back to saved throws them away).', 'unsaved'); else showState();

// Save: to the game's folder through the local save script, else downloaded
const download = (text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = 'decor.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
TL.save = async ({ downloadOnly = false } = {}) => {
  const text = TL.text();
  if (LOCAL && !downloadOnly) {
    try { const r = await fetch(SAVE_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: text });
      if (r.ok) { SAVED = text; say('Saved into the game (models/town/decor.json). Reload the game to see it.', 'saved'); return 'server'; } } catch (e) { /* not running: downloaded instead */ }
  }
  download(text); SAVED = text; say('Downloaded decor.json: hand it over to put it in the game.', 'saved'); return 'download';
};
$('tlSave').onclick = () => TL.save();
$('tlDownload').onclick = () => TL.save({ downloadOnly: true });
addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); TL.save(); } });
// Open…: a decor file in place of the town as it is now (one step for Undo, as the Build bar's Load default)
TL.open = (decor) => {
  if (!decor || typeof decor !== 'object' || (decor.v && decor.v !== 1)) { say("That isn't a decor file.", 'unsaved'); return false; }
  const D = appliedOf(decor), n0 = tool.log.length;
  tool.townBefore(); tool.town.setLayout(D.layout); tool.replace(D.planting, true);
  tool.log.splice(n0, tool.log.length - n0, 'B'); tool.syncUndo();
  say('Opened. Save puts it into the game.', 'unsaved'); return true;
};
$('tlLoad').onclick = () => $('tlFile').click();
$('tlFile').onchange = async () => { const f = $('tlFile').files[0]; if (!f) return; try { TL.open(JSON.parse(await f.text())); } catch (e) { say("That file isn't a decor file.", 'unsaved'); } $('tlFile').value = ''; };
$('tlRevert').onclick = async () => { if (TL.text() === SAVED || confirm('Throw away the changes since the last save? (Undo can bring them back.)')) { await tool.loadDefault(); SAVED = TL.text(); say('Back to the saved town.'); } };

// ── quick picks: the Build bar set for the job ───────────────────────────────────────────────────────────────────
const use = (state, info) => {
  const was = bar.state.open; bar.setState({ open: true, ...state });
  if (!was) tool.barChanged({ ...bar.state }, 'open');
  tool.barChanged({ ...bar.state }, 'mode'); if (state.gizmo) tool.barChanged({ ...bar.state }, 'gizmo');
  bar.setInfo(info);
  document.querySelectorAll('[data-pick]').forEach((b) => b.classList.toggle('on', b === picked)); picked = null;
};
let picked = null;
const FLOWERS = ['paintbrush', 'columbine', 'dandelion', 'violets', 'snowdrops', 'marsh marigold', 'wild strawberry', 'broad-leaf hosta'];
for (const n of FLOWERS) { const k = KIND_INFO.findIndex((K) => K.name === n); if (k >= 0) $('tlFlower').add(new Option(n, k)); }
const PICKS = {
  move: () => use({ mode: 'select', gizmo: 'translate' }, 'Click a building or prop, then drag an arrow (or the white ball) to move it.'),
  turn: () => use({ mode: 'select', gizmo: 'rotate' }, 'Click a building or prop, then drag across the green ring to turn it.'),
  fence: () => use({ mode: 'paint', kind: PLANT.FENCE, size: 1 }, 'Drag along the ground to run a fence; let go to finish it.'),
  unfence: () => use({ mode: 'clear', kind: PLANT.FENCE, brush: 1.5 }, 'Drag over a fence to take it down.'),
  flowers: () => use({ mode: 'paint', kind: +$('tlFlower').value, brush: 2.5, density: 5, size: 1 }, 'Drag to paint flowers (the brush size and thickness are on the bar).'),
  erase: () => use({ mode: 'clear', kind: +$('tlFlower').value, brush: 2 }, 'Drag to rub out plants and flowers.'),
};
const PUT = ['barrel', 'crate', 'hitchingPost', 'trough', 'lantern', 'garden', 'flowerBed', 'planter', 'bench', 'picnicTable', 'signpost'];
for (const kind of PUT) {
  const i = PROP_KINDS.findIndex((P) => P.kind === kind); if (i < 0) continue;
  PICKS[kind] = () => use({ mode: 'paint', kind: PLANT.PROP0 + i }, `Click the ground to put down a ${PROP_KINDS[i].name.toLowerCase()}; again for another.`);
  const b = document.createElement('button'); b.type = 'button'; b.dataset.pick = kind; b.textContent = PROP_KINDS[i].name; $('tlProps').appendChild(b);
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-pick]'); if (b && PICKS[b.dataset.pick]) { picked = b; PICKS[b.dataset.pick](); } });
$('tlFlower').onchange = () => { if (bar.state.mode === 'paint' && KIND_INFO[bar.state.kind]) PICKS.flowers(); };
$('tlFold').onclick = () => { const p = $('tlPanel'), f = p.classList.toggle('folded'); $('tlFold').textContent = f ? 'Show' : 'Hide'; $('tlFold').setAttribute('aria-expanded', String(!f)); };
// (the panel keeps clear of the Build bar along the bottom)
new ResizeObserver(() => { const r = bar.el.querySelector('.pb-bar').getBoundingClientRect(); document.documentElement.style.setProperty('--bar-room', (r.height ? r.height + 12 : 0) + 'px'); }).observe(bar.el);

// ── snapping: a town thing moved snaps to the half metre, turned to 15° (only what changed: moving doesn't turn it) ──
const SNAP = { m: 0.5, deg: 15 };
const snapOn = () => $('tlSnap').checked;
{ const T = tool.town, change = T.change, add = T.add, snapM = (v) => +(Math.round(v / SNAP.m) * SNAP.m).toFixed(2);
  T.change = (id, f, done) => {
    const it = T.get(id);
    if (snapOn() && f && it) {
      if ('x' in f && Math.abs(f.x - it.x) > 1e-3) f.x = snapM(f.x);
      if ('z' in f && Math.abs(f.z - it.z) > 1e-3) f.z = snapM(f.z);
      if ('rot' in f && Math.abs(f.rot - it.rot) > 1e-3) f.rot = ((Math.round(f.rot / SNAP.deg) * SNAP.deg) % 360 + 360) % 360;
    }
    return change(id, f, done);
  };
  T.add = (key, x, z) => (snapOn() ? add(key, snapM(x), snapM(z)) : add(key, x, z));
}
// ── straight fence runs: a dragged fence line pulled straight between its corners (and its corners snapped) ─────
function straighten(pts, tol) {   // (Douglas-Peucker: the fewest points within tol of the line drawn)
  if (pts.length < 3) return pts;
  const [ax, az] = pts[0], [bx, bz] = pts[pts.length - 1], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1e-9;
  let far = 0, at = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs((pts[i][0] - ax) * dz - (pts[i][1] - az) * dx) / L; if (d > far) { far = d; at = i; } }
  if (far <= tol) return [pts[0], pts[pts.length - 1]];
  return [...straighten(pts.slice(0, at + 1), tol).slice(0, -1), ...straighten(pts.slice(at), tol)];
}
{ const finish = tool.finish.bind(tool);
  tool.finish = (s) => {
    if (s && s.kind === PLANT.FENCE && s.mode === 'paint' && s.pts.length > 1 && $('tlStraight').checked) {
      let p = straighten(s.pts, 0.8);
      if (snapOn()) p = p.map(([x, z]) => [+(Math.round(x / SNAP.m) * SNAP.m).toFixed(2), +(Math.round(z / SNAP.m) * SNAP.m).toFixed(2)]);
      s.pts = p.filter((q, i) => !i || q[0] !== p[i - 1][0] || q[1] !== p[i - 1][1]);
    }
    return finish(s);
  };
}
PICKS.move();
document.querySelector('[data-pick="move"]').classList.add('on');
TL.ready = true;
