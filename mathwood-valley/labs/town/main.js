// THE TOWN LAB: the game's own valley and town (world/valley.js, the very modules the game draws them with) with the
// Terrain Lab's editing tools on (the Build bar: plantTool.js, its gizmo, the town editor), for decorating the town:
// moving and turning the buildings and props, putting down fences, barrels, crates, troughs, lanterns and gardens,
// painting flowers. What it makes is models/town/decor.json (decorfile.js writes it, world/objects/decor.js is how the
// game reads it): the changes from the shipped town only. Nothing of this page is in the game.
//   Save: served from this machine (127.0.0.1 or localhost), sent to the little save script
//   (~/pw/bandit-math/rigs/town/save_server.cjs, port 8998), which writes it into the game's folder; anywhere else (or
//   with the script not running) downloaded, to hand over. Open… reads one back; Back to saved goes back to the game's.
// The work in hand is also kept in this browser as it goes (the Build bar's own copy), so a reload doesn't lose it.
// Fences: a style picked from the pictures goes on the next fence run (saved on its stroke as `style`; the plain fence
// has none), the Gate tool puts a gate in the fence clicked (it takes that fence's style), Height sizes the next run.
// ONE MENU: the Build bar along the bottom (every kind of thing, Select / Add / Clear, Move and Turn with Snap, Undo,
// Redo); a slim strip along the top (Save, Download, Open, Back to saved, the views, help); and while a fence or a
// flower is picked on the bar, its choices in a small row just over it (the fence's style pictures, height, Straight
// runs, Draw, Gate, Take down; Paint, Rub out). FLYING THE VIEW: W A S D along the ground the way the view faces, Space
// up, C down, Shift faster (quicker the higher up); the mouse drags and zooms as before (OrbitControls).
// GRAPHICS: a choice on the Build bar, showing the tier in use: Auto (the game's own answer for this computer) or a tier for this
// lab alone (kept in this browser; the game's own choice is left as it is). It reloads the lab: the work in hand is kept.
// PAINTED LAWN shows here while the lawn is picked, whatever the tier and however high the view (the lawn's tufts are drawn only
// near the camera, and never on potato): the tufts round the brush, and a faint green tint over it (lawnmap.js). With anything
// else picked the tint is hidden, so the town looks as it does in the game.
// SAVE TIDIES UP: strokes that do nothing are left out of the file and out of the work in hand (tidy.js); then strokes of one
// sort that overlap are made one and each stroke keeps only the points it needs, the ground coming out close (merge.js:
// a little may change at the edges, never on a building, prop, placed plant or in front of a door). Undo brings them back.
// For rigs: window.TL = { ready, V, tool, text(), savedText(), save(), open(decor), view(name), look(..), screen(x, y, z), camera, fps,
//   fences: { style(), setStyle(id), height(v), stats(), icons }, pick(name), fly: { keys(), speed() } }
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeValley, TIER_SET } from '../../world/valley.js';
import { chooseTier, wantAntialias, TIERS } from '../../world/quality.js';
import { BASE } from '../../world/base.js';
import { VillageEditor } from '../../world/objects/villageEditor.js';
import { normalise as normaliseTown, footprintOf } from '../../world/objects/village.js';
import { normalisePlanting, newId, newSeed } from '../../world/objects/planting.js';
import { applyDecor } from '../../world/objects/decor.js';
import { PROP_KINDS } from '../../world/objects/townProps.js';
import { KIND_INFO } from '../../world/objects/growth.js';
import { BACKWOODS } from '../../src/missions/backwoods.js';
import { makeDecor, decorText } from './decorfile.js';
import { FENCE_STYLES, PLAIN, GATES, styleInfo, nearestFence } from '../../world/objects/fenceplan.js';
import { makeCodePlaces } from './codeplaces.js';
import { tidyStrokes } from './tidy.js';
import { mergeStrokes, makeGuard } from './merge.js';
import { makeLawnMap } from './lawnmap.js';

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const LOCAL = ['127.0.0.1', 'localhost'].includes(location.hostname);
const SAVE_URL = 'http://127.0.0.1:8998/decor';
const TL = window.TL = { ready: false, fps: 0 };
const say = (text, cls = '') => { const s = $('tlStatus'); s.textContent = text; s.className = 'tl-status' + (cls ? ' ' + cls : ''); };

// ── the renderer and camera, as the game makes them (src/main.js, src/world.js) ───────────────────────────────────
const GFX_KEY = 'mathwood.townlab.quality';   // (this lab's own Graphics choice: the game's is left alone)
const labTier = (() => { try { const s = localStorage.getItem(GFX_KEY); return TIERS.includes(s) ? s : null; } catch (e) { return null; } })();
const qTier = TIERS.includes(Q.get('q')) ? Q.get('q') : null, pickTier = qTier || labTier;
const renderer = new THREE.WebGLRenderer({ antialias: pickTier ? pickTier !== 'potato' : wantAntialias(), powerPreference: 'high-performance' });
const QUAL = !qTier && labTier ? { tier: labTier, why: 'chosen in this lab', source: 'saved' } : chooseTier(renderer), TS = TIER_SET[QUAL.tier];
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
// (the painted lawn shows on every tier here: on potato the land's own lawn stays off, density 0, and only what's painted is laid)
if (!(V.LAWN.radius > 0)) { V.LAWN.radius = 40; V.LAWN.density = 0; }
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
for (const name of Object.keys(VIEWS)) $('tlView').add(new Option(name, name));
$('tlHour').onchange = () => { const h = +$('tlHour').value; if (h) { V.DAY.hour = h; V.DAY.dirty = true; } $('tlHour').blur(); };   // (the time of day, to see the fog at its hours)
$('tlView').onchange = () => { const v = $('tlView').value; if (VIEWS[v]) VIEWS[v](); $('tlView').value = ''; $('tlView').blur(); };
TL.view = (n) => VIEWS[n] && VIEWS[n]();
TL.look = look; TL.camera = camera; TL.renderer = renderer; TL.controls = controls;
TL.screen = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera), r = renderer.domElement.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, behind: v.z > 1 }; };   // (rigs: where a spot is on screen)
VIEWS['The square']();

// ── flying the view from the keyboard: W A S D along the ground the way it faces, Space up, C down, Shift faster ──
// (the camera and the point it turns round move together, so the mouse goes on turning the view round what's ahead.
// The speed grows with the height over the ground: slow near it, quick high up; it eases in and out. Not while typing
// in a box, and Ctrl/Cmd keys stay the page's: Ctrl+S saves, Ctrl+Z/Y undo and redo)
const FLY = { KeyW: [0, 0, 1], KeyS: [0, 0, -1], KeyA: [-1, 0, 0], KeyD: [1, 0, 0], Space: [0, 1, 0], KeyC: [0, -1, 0] };
const FLYING = { keys: new Set(), fast: false, vel: new THREE.Vector3(), slow: 4, perHeight: 0.9, most: 150, shift: 3, ease: 7, up: 0.7, floor: 1.2 };
const typingIn = (t) => !!t && (t.isContentEditable || (['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName) && t.type !== 'range' && t.type !== 'checkbox'));
addEventListener('keydown', (e) => {
  FLYING.fast = e.shiftKey;
  if (!FLY[e.code] || e.ctrlKey || e.metaKey || e.altKey || typingIn(e.target) || typingIn(document.activeElement) || document.querySelector('.pb-modal')) return;
  FLYING.keys.add(e.code); if (e.code === 'Space') e.preventDefault();   // (Space: no page scroll, no button pressed again)
});
addEventListener('keyup', (e) => { FLYING.fast = e.shiftKey; FLYING.keys.delete(e.code); });
addEventListener('blur', () => FLYING.keys.clear());
const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _want = new THREE.Vector3(), _step = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function fly(dt) {
  const F = FLYING; let fx = 0, fy = 0, fz = 0;
  for (const k of F.keys) { const v = FLY[k]; fx += v[0]; fy += v[1]; fz += v[2]; }
  const p = camera.position, above = Math.max(0.5, p.y - heightAt(p.x, p.z));
  const speed = Math.min(F.most, Math.max(F.slow, above * F.perHeight)) * (F.fast ? F.shift : 1);
  camera.getWorldDirection(_fwd); _fwd.y = 0; if (_fwd.lengthSq() < 1e-8) _fwd.set(0, 0, -1); _fwd.normalize();
  _right.crossVectors(_fwd, UP).normalize();
  _want.set(0, 0, 0).addScaledVector(_fwd, fz).addScaledVector(_right, fx); if (_want.lengthSq() > 1) _want.normalize();
  _want.multiplyScalar(speed); _want.y = fy * speed * F.up;
  F.vel.lerp(_want, 1 - Math.exp(-F.ease * dt));
  if (!F.keys.size && F.vel.lengthSq() < 0.0004) { F.vel.set(0, 0, 0); return; }
  _step.copy(F.vel).multiplyScalar(dt); p.add(_step); controls.target.add(_step);
  const floor = heightAt(p.x, p.z) + F.floor; if (p.y < floor) { controls.target.y += floor - p.y; p.y = floor; if (F.vel.y < 0) F.vel.y = 0; }   // (never into the ground)
}
TL.fly = { keys: () => [...FLYING.keys], speed: () => FLYING.vel.length(), set: (o) => Object.assign(FLYING, o) };

// ── the frame loop ─────────────────────────────────────────────────────────────────────────────────────────────
const fit = () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); renderer.getDrawingBufferSize(V.U.res.value); };
addEventListener('resize', fit); fit();
let last = performance.now(), frames = 0, fpsT = last;
let lawnNearBrush = () => {};   // (set once the Build bar is up: painted lawn, always to be seen, below)
renderer.info.autoReset = false;
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now; frames++;
  renderer.info.reset();
  fly(dt);
  lawnNearBrush();
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
const nameOf = (o) => { const k = tool.kindOf(o.kind); const n = plain(k.name); if (!n) return '';
  if (o.mode === 'clear') return n === 'fence' ? 'fence taken down' : n === 'gate' ? 'gate taken out' : 'cleared';
  return n === 'fence' && FENCE_STYLES[o.style] ? FENCE_STYLES[o.style].name.toLowerCase() + ' fence' : n; };
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
// what the merge may not paint over (merge.js makeGuard): the buildings and props as they stand now (the code-built ones'
// walls, rooms and porches too), the town's trees and the placed plants, and the ground in front of every door
const SPOT = { plant: 0.5, tree: 1 };   // (m round a placed plant, a placed tree or rock, a town tree)
TL.guardData = () => {
  const rects = [], spots = [], C = V.CODE;
  for (const it of TOWN.village.layout.items) {
    if (it.type === 'tree') { spots.push({ x: it.x, z: it.z, r: SPOT.tree * (it.size || 1) }); continue; }
    const f = footprintOf(it); rects.push({ x: it.x, z: it.z, rot: (it.rot || 0) * Math.PI / 180, w: f.w, d: f.d });
  }
  for (const i of tool.planting.items) spots.push({ x: i.x, z: i.z, r: i.kind >= PLANT.TREE0 ? SPOT.tree : SPOT.plant });
  const doors = C && C.doors ? C.doors.list.map((d) => ({ x: d.x, z: d.z, ox: d.ox || 0, oz: d.oz || 0, half: d.half || 0.5 })) : [];
  return { rects, spots, doors };
};
const townGuard = () => { const C = V.CODE; return makeGuard({ ...TL.guardData(), inside: C ? (x, z) => C.blocked(x, z) || !!C.room(x, heightAt(x, z) + 0.6, z) : null }); };
// (the tidy-up: the strokes that do nothing go (tidy.js: the town comes out the same), then the overlapping ones are made
// one and the lines kept simple (merge.js: the town comes out close); one step for Undo)
TL.tidy = () => {
  const keep = new Set(SHIPPED.planting.strokes.map((s) => s.id)), { strokes, dropped } = tidyStrokes(tool.planting, { PLANT, keep });
  const M = mergeStrokes({ ...tool.planting, strokes }, { PLANT, keep, guard: townGuard() });
  if (dropped.length || M.merged.length) { tool.before(); tool.planting.strokes = M.strokes; tool.commit(); }
  return { dropped, merged: M.merged, joined: M.groups.reduce((a, g) => a + g.from.length, 0), into: M.groups.length, simpler: M.merged.filter((m) => m.what === 'points').length };
};
TL.save = async ({ downloadOnly = false } = {}) => {
  say('Saving: tidying the strokes…'); await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));   // (said, and drawn, before the tidy-up's second or so)
  const T = TL.tidy(), n = T.dropped.length, s = (k) => (k === 1 ? '' : 's'), text = TL.text();
  const tidied = (n ? ` ${n} stroke${s(n)} that did nothing left out.` : '') + (T.into ? ` ${T.joined} overlapping strokes made into ${T.into}.` : '') + (T.simpler ? ` ${T.simpler} stroke${s(T.simpler)} made simpler.` : '');
  if (LOCAL && !downloadOnly) {
    try { const r = await fetch(SAVE_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: text });
      if (r.ok) { SAVED = text; say(`Saved into the game (models/town/decor.json).${tidied} Reload the game to see it.`, 'saved'); return 'server'; } } catch (e) { /* not running: downloaded instead */ }
  }
  download(text); SAVED = text; say(`Downloaded decor.json: hand it over to put it in the game.${tidied}`, 'saved'); return 'download';
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

// ── quick picks: the Build bar set for the job (the buttons in the row over the bar; rigs: TL.pick(name)) ──────────
const use = (state, info) => {
  const was = bar.state.open; bar.setState({ open: true, ...state });
  if (!was) tool.barChanged({ ...bar.state }, 'open');
  tool.barChanged({ ...bar.state }, 'mode'); if (state.gizmo) tool.barChanged({ ...bar.state }, 'gizmo');
  bar.setInfo(info); syncOpts();
};
let fenceStyle = 'picketWhite', fenceH = 1;
const FLOWER = KIND_INFO.findIndex((K) => K.name === 'paintbrush');   // (the flowers' Paint with no plant picked on the bar)
const isPlant = (k) => Number.isInteger(k) && k >= 0 && k < KIND_INFO.length;
const plantNow = () => (isPlant(bar.state.kind) ? bar.state.kind : Math.max(0, FLOWER));
const PICKS = {
  move: () => use({ mode: 'select', gizmo: 'translate' }, 'Click a building or prop, then drag an arrow (or the white ball) to move it.'),
  turn: () => use({ mode: 'select', gizmo: 'rotate' }, 'Click a building or prop, then drag across the green ring to turn it.'),
  fence: () => use({ mode: 'paint', kind: PLANT.FENCE, size: fenceH }, `Press and drag for a straight ${(fenceStyle === 'plain' ? PLAIN : FENCE_STYLES[fenceStyle]).name.toLowerCase()} fence, let go to put it down; start or end near a post to join it (it lights up).`),
  gate: () => use({ mode: 'paint', kind: PLANT.GATE, brush: 0.6 }, 'Click on a fence to put a gate in it: it takes the fence\'s style (Take down takes it out).'),
  unfence: () => use({ mode: 'clear', kind: PLANT.FENCE, brush: 1.5 }, 'Drag over a fence to take it down.'),
  flowers: () => use({ mode: 'paint', kind: plantNow(), brush: 2.5, density: 5, size: 1 }, 'Drag to paint flowers (the brush size and thickness are on the bar).'),
  erase: () => use({ mode: 'clear', kind: plantNow(), brush: 2 }, 'Drag to rub out plants and flowers.'),
};
TL.pick = (name) => { if (!PICKS[name]) return false; PICKS[name](); return true; };
document.addEventListener('click', (e) => { const b = e.target.closest('[data-pick]'); if (b && PICKS[b.dataset.pick]) PICKS[b.dataset.pick](); });
// the row over the bar: a fence's choices while a fence or a gate is picked on it, a flower's while a plant is; the
// button for what the bar is doing now lit
function syncOpts() {
  const s = bar.state, fence = s.kind === PLANT.FENCE || s.kind === PLANT.GATE, plant = isPlant(s.kind) && s.mode !== 'select';
  $('tlFenceOpts').hidden = !fence; $('tlFlowerOpts').hidden = !plant;
  $('tlOpts').hidden = !s.open || !(fence || plant) || !bar.shown;
  if (plant) $('tlFlowerName').textContent = KIND_INFO[s.kind].name;
  const on = { fence: s.kind === PLANT.FENCE && s.mode === 'paint', gate: s.kind === PLANT.GATE, unfence: s.kind === PLANT.FENCE && s.mode === 'clear',
    flowers: plant && s.mode === 'paint', erase: plant && s.mode === 'clear' };
  document.querySelectorAll('.tl-opts [data-pick]').forEach((b) => b.classList.toggle('on', !!on[b.dataset.pick]));
}
{ const told = bar.onChange; bar.onChange = (st, key) => { if (told) told(st, key); syncOpts(); }; }   // (a pick on the bar itself, its Hide too)
// Snap on the bar, beside Move / Turn / Size: a thing moved snaps to the half metre, turned to 15°, put down on the half metre
{ const l = document.createElement('label'); l.className = 'pb-check tl-snap'; l.title = 'Moving: to the half metre; turning: to 15°; putting down: on the half metre';
  l.innerHTML = '<input type="checkbox" id="tlSnap" checked> Snap'; bar.el.querySelector('.pb-gizmo').after(l); }
// Graphics on the bar too: the tier in use, or one for this lab alone (a tier can't change without a reload; the work in hand is kept)
{ const l = document.createElement('label'); l.className = 'pb-check tl-gfx'; l.title = `The graphics this lab draws with. Auto: what the game would pick on this computer. In use now: ${QUAL.tier}`;
  const on = qTier || labTier || 'auto', name = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  l.innerHTML = `Graphics <select id="tlGfx" aria-label="Graphics"><option value="auto">Auto${on === 'auto' ? ` (${name(QUAL.tier)})` : ''}</option>${TIERS.map((t) => `<option value="${t}">${name(t)}</option>`).join('')}</select>`;
  bar.el.querySelector('.tl-snap').after(l);
  const pick = l.querySelector('select'); pick.value = on;
  pick.onchange = () => { try { if (pick.value === 'auto') localStorage.removeItem(GFX_KEY); else localStorage.setItem(GFX_KEY, pick.value); } catch (e) { /* no storage */ }
    Q.delete('q'); const qs = Q.toString(); location.href = location.pathname + (qs ? '?' + qs : ''); };
  TL.gfx = { tier: QUAL.tier, on }; }
// the row over the bar keeps clear of it (and goes with it when it hides)
new ResizeObserver(() => { const r = bar.el.querySelector('.pb-bar').getBoundingClientRect(); document.documentElement.style.setProperty('--bar-room', (r.height ? r.height + 12 : 0) + 'px'); syncOpts(); }).observe(bar.el);
// the top strip: a click lets go of the keyboard (Space flies up, it doesn't press Save again); help opens and shuts
$('tlTop').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && e.detail) b.blur(); });
$('tlHelpBtn').onclick = () => { const h = $('tlHelp'), open = h.hidden; h.hidden = !open; $('tlHelpBtn').setAttribute('aria-expanded', String(open)); };

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
    if (s && s.kind === PLANT.FENCE && s.mode === 'paint' && fenceStyle !== 'plain') s.style = fenceStyle;   // (the picked look, kept on the stroke)
    if (s && s.kind === PLANT.GATE && s.mode === 'paint') {   // (a gate: on the fence clicked, or nowhere)
      const [x, z] = s.pts[s.pts.length - 1], n = V.FENCE.plan && nearestFence(V.FENCE.plan, x, z);
      if (!n) { bar.setInfo('No fence there: click right on a fence to put a gate in it.'); return; }
      s.pts = [[+n.x.toFixed(2), +n.z.toFixed(2)]]; s.r = 0.6;
      const r = finish(s);   // (the fences are laid again a moment later: then it says what went in)
      setTimeout(() => { const g = V.FENCE.plan && V.FENCE.plan.gates.find((q) => q.id === s.id); bar.setInfo(g ? `A ${GATES[g.kind].name} put in, ${g.w.toFixed(1)} m wide (Undo takes it out).` : 'No room for a gate there (another gate, or the fence is too short).'); }, 300);
      return r;
    }
    if (s && s.kind === PLANT.FENCE && s.mode === 'paint' && s.pts.length > 1) {   // (a fence that comes through the brush after all: pulled straight)
      let p = straighten(s.pts, 0.8);
      if (snapOn()) p = p.map(([x, z]) => [+(Math.round(x / SNAP.m) * SNAP.m).toFixed(2), +(Math.round(z / SNAP.m) * SNAP.m).toFixed(2)]);
      s.pts = p.filter((q, i) => !i || q[0] !== p[i - 1][0] || q[1] !== p[i - 1][1]);
    }
    return finish(s);
  };
}
// ── fence styles: the picker (a picture of each), the height, the gate tool ─────────────────────────────────────────
TL.fences = { style: () => fenceStyle, setStyle: (id) => pickStyle(id), height: (v) => { $('tlFenceH').value = v; fenceHeight(); }, icons: {}, stats: () => fenceStats() };
const STYLE_IDS = [...Object.keys(FENCE_STYLES), 'plain'];
for (const id of STYLE_IDS) {
  const S = id === 'plain' ? PLAIN : FENCE_STYLES[id], b = document.createElement('button');
  b.type = 'button'; b.className = 'tl-style'; b.dataset.style = id; b.title = `${S.name}: ${S.note}`; b.setAttribute('role', 'radio');
  b.innerHTML = `<img alt="" width="120" height="80"><span>${S.name}</span>`;
  b.onclick = () => { pickStyle(id); PICKS.fence(); };
  $('tlStyles').appendChild(b);
}
function pickStyle(id) {
  fenceStyle = STYLE_IDS.includes(id) ? id : 'plain';
  document.querySelectorAll('.tl-style').forEach((b) => { const on = b.dataset.style === fenceStyle; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
  fenceHeight();
}
function fenceHeight() {
  fenceH = +$('tlFenceH').value;
  $('tlFenceHOut').textContent = `${(styleInfo(fenceStyle === 'plain' ? null : fenceStyle).h * fenceH).toFixed(2)} m`;
  if (bar.state.mode === 'paint' && bar.state.kind === PLANT.FENCE) bar.setState({ size: fenceH });
}
$('tlFenceH').oninput = fenceHeight;
pickStyle(fenceStyle);
// the pictures: drawn once the wood (and, for the wall, the stone) is in
{ const maker = V.FENCE.make(), draw = (id) => { try { const src = maker.icon(id === 'plain' ? null : id, renderer); TL.fences.icons[id] = src; const img = document.querySelector(`.tl-style[data-style="${id}"] img`); if (img) img.src = src; } catch (e) { console.error('fence icon', id, e); } };
  maker.woodReady.then(() => { STYLE_IDS.filter((id) => id !== 'stone').forEach(draw); return maker.loadStone(); }).then(() => draw('stone')); }
// the number of triangles in 10 m of each style (and with a gate), and its draws (rigs)
function fenceStats() {
  const maker = V.FENCE.make(), out = {};
  for (const id of [...Object.keys(FENCE_STYLES), 'plain']) out[id] = { run: maker.sample(id, { len: 10 }), gate: maker.sample(id, { len: 10, gate: true }) };
  return { styles: out, bytes: maker.info.bytes };
}
// ── the game's own things (the farm, the homestead behind the player's cabin, the mill hill, the range, the jobs board):
// outlines and names on the ground, so the town is laid out round them (codeplaces.js); the button in the strip hides them
// (the farm's place: the layout's game.farm, else the game's own spot, as src/world.js has it)
const FARM_AT = () => { const f = GAME.farm; return f ? { x: +f.x || 0, z: +f.z || 0, rot: (+f.rot || 0) * Math.PI / 180, w: +f.w || 56, d: +f.d || 48 } : { x: -6, z: -278, rot: 0, w: 56, d: 48 }; };
makeCodePlaces({ scene: V.scene, heightAt, cabin: () => TOWN.village.item('cabin'), farm: FARM_AT }).then((cp) => {
  TL.code = cp; setInterval(() => cp.update(), 1000);
  $('tlCode').onclick = () => { cp.show(!cp.shown); $('tlCode').setAttribute('aria-pressed', String(cp.shown)); };
}).catch((e) => console.error('town lab: the game\'s own things could not be shown', e));
// ── FENCES DRAWN A STRAIGHT SEGMENT AT A TIME ───────────────────────────────────────────────────────────────────
// With the fence picked (Draw), a press starts a segment and the drag shows it straight from there to the pointer: its
// posts as the style spaces them, and its length; letting go puts it down. A press near a fence's post starts from that
// very post (lit while the pointer is near it), and a segment begun at the end post of a run of the same look and
// height goes on as that run (one stroke, one post at the corner); let go near a post and it ends on that post (back on
// its own first post: a closed pen). Free ends snap to the half metre, and the direction to 15°, with Snap on. Esc lets
// go of a segment being drawn; Undo takes the last one away. (The tool's own brush never sees a fence stroke: these
// handlers go first and keep the events)
const FD = { drag: null, mouse: 16, touch: 28, min: 0.4,
  gap: { plain: 2.2, picketWhite: 2.4, picket: 2.4, corral: 2.45, worm: 3.2, buck: 3, wire: 4, stone: 2, logRail: 2.9, wattle: 1.5 } };
const fenceOn = () => bar.state.open && bar.state.mode === 'paint' && bar.state.kind === PLANT.FENCE;
const canvasEl = renderer.domElement;
// the posts a segment can start or end on: every fence stroke's corners and ends, and the plain fences' posts
function fencePosts() {
  const out = [];
  tool.planting.strokes.forEach((st) => { if (st.kind !== PLANT.FENCE || st.mode !== 'paint') return; st.pts.forEach((p, i) => out.push({ x: p[0], z: p[1], st, i, end: i === 0 || i === st.pts.length - 1 })); });
  for (const r of V.FENCE.rails || []) if (r[3] == null) for (const p of [r[0], r[1]]) out.push({ x: p[0], z: p[2] });   // (styled runs' lines aren't posts)
  return out;
}
// the post nearest the pointer, within the snap reach on screen (bigger for a finger), or within a metre on the ground
function postNear(cx, cy, g, touch) {
  const r = canvasEl.getBoundingClientRect(), V3 = new THREE.Vector3(); let best = null, bd = Infinity;
  for (const q of fencePosts()) {
    V3.set(q.x, heightAt(q.x, q.z) + 0.6, q.z).project(camera); if (V3.z > 1) continue;
    const px = Math.hypot(r.left + (V3.x + 1) / 2 * r.width - cx, r.top + (1 - V3.y) / 2 * r.height - cy), m = g ? Math.hypot(q.x - g.x, q.z - g.z) : Infinity;
    const d = Math.min(px, m < 1 ? 0 : Infinity); if ((px < (touch ? FD.touch : FD.mouse) || m < 1) && d + px * 1e-3 < bd) { bd = d + px * 1e-3; best = q; }
  }
  return best;
}
const snapHalf = (v) => +(Math.round(v / SNAP.m) * SNAP.m).toFixed(2);
// a free end: the pointer's spot; with Snap on, the way from the start turned to 15° and the length to the half metre
function freeEnd(a, g) {
  if (!snapOn()) return [+g.x.toFixed(2), +g.z.toFixed(2)];
  const L = Math.max(SNAP.m, Math.round(Math.hypot(g.x - a[0], g.z - a[1]) / SNAP.m) * SNAP.m), step = SNAP.deg * Math.PI / 180, ang = Math.round(Math.atan2(g.z - a[1], g.x - a[0]) / step) * step;
  return [+(a[0] + Math.cos(ang) * L).toFixed(2), +(a[1] + Math.sin(ang) * L).toFixed(2)];
}
// the preview: the segment, its posts, the post it snaps to, and its length
const FDV = { line: new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffe08a, depthTest: false, transparent: true })),
  posts: new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.09, 1.2, 6).translate(0, 0.6, 0), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.75, depthTest: false }), 64),
  hot: [0, 1].map(() => new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.07, 6, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5cff9a, depthTest: false, transparent: true }))),
  label: document.createElement('div') };
FDV.line.renderOrder = FDV.posts.renderOrder = 30; FDV.hot.forEach((h) => { h.renderOrder = 31; V.scene.add(h); h.visible = false; });
V.scene.add(FDV.line, FDV.posts); FDV.line.visible = FDV.posts.visible = false; FDV.posts.frustumCulled = false;
FDV.label.style.cssText = 'position:fixed;z-index:8;pointer-events:none;transform:translate(-50%,-140%);background:rgba(20,14,8,.88);color:#ffe08a;font:600 13px Bitter,Georgia,serif;padding:2px 7px;border-radius:6px;border:1px solid #c9a24a;display:none';
document.body.appendChild(FDV.label);
function showHot(k, q) { const h = FDV.hot[k]; h.visible = !!q; if (q) h.position.set(q.x, heightAt(q.x, q.z) + 0.25, q.z); }
function showSegment(a, b) {
  if (!a) { FDV.line.visible = FDV.posts.visible = false; FDV.label.style.display = 'none'; return; }
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L)), pts = [];
  for (let i = 0; i <= n; i++) { const x = a[0] + (b[0] - a[0]) * i / n, z = a[1] + (b[1] - a[1]) * i / n; pts.push(new THREE.Vector3(x, heightAt(x, z) + 0.25, z)); }
  FDV.line.geometry.dispose(); FDV.line.geometry = new THREE.BufferGeometry().setFromPoints(pts); FDV.line.visible = true;
  const gap = FD.gap[fenceStyle] || 2.4, k = Math.max(1, Math.round(L / gap)), M = new THREE.Matrix4(), sc = (styleInfo(fenceStyle === 'plain' ? null : fenceStyle).h * fenceH) / 1.2;
  let c = 0; for (let i = 0; i <= k && c < 64; i++, c++) { const x = a[0] + (b[0] - a[0]) * i / k, z = a[1] + (b[1] - a[1]) * i / k; FDV.posts.setMatrixAt(c, M.makeScale(1, sc, 1).setPosition(x, heightAt(x, z), z)); }
  FDV.posts.count = c; FDV.posts.instanceMatrix.needsUpdate = true; FDV.posts.visible = L > 0.05;
  const mid = new THREE.Vector3((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2); mid.y = heightAt(mid.x, mid.z) + 1.4; mid.project(camera);
  const r = canvasEl.getBoundingClientRect(); FDV.label.textContent = `${L.toFixed(1)} m`; FDV.label.style.left = `${r.left + (mid.x + 1) / 2 * r.width}px`; FDV.label.style.top = `${r.top + (1 - mid.y) / 2 * r.height}px`; FDV.label.style.display = L > 0.05 ? '' : 'none';
}
function cancelSegment() { if (!FD.drag) return; try { canvasEl.releasePointerCapture(FD.drag.id); } catch (e) { /* gone */ } FD.drag = null; controls.enabled = true; showSegment(null); showHot(0, null); showHot(1, null); }
// put it down: going on as the run it began from (its end post, the same look and height), else a run of its own
function placeSegment(d) {
  const { a, b, from, to } = d, style = fenceStyle === 'plain' ? undefined : fenceStyle, same = (st) => (st.style || undefined) === style && Math.abs((+st.size || 1) - fenceH) < 1e-6;
  const S = tool.planting.strokes, at = from && from.st && from.end && same(from.st) ? S.indexOf(from.st) : -1;
  tool.before();
  if (at >= 0) {
    const st = S[at], pts = st.pts.map((p) => [p[0], p[1]]);
    if (from.i === 0 && pts.length > 1) pts.unshift(b); else pts.push(b);
    S[at] = { ...st, pts };   // (a new object for the changed run: the planting's index and the fences laid again from it)
  } else S.push({ id: newId(), mode: 'paint', kind: PLANT.FENCE, r: 1.5, density: 2, size: fenceH, seed: newSeed(), ...(style ? { style } : {}), pts: [a, b] });
  tool.commit();
  const closed = to && from && to.st && to.st === from.st && at >= 0 && (to.i === 0 || to.i === from.st.pts.length - 1) && to.i !== from.i;
  bar.setInfo(`${Math.hypot(b[0] - a[0], b[1] - a[1]).toFixed(1)} m of fence put down${at >= 0 ? ', on from the run it began at' : ''}${closed ? ': the run closed' : ''}. Drag again from its end post for the next side; Undo takes it away.`);
}
function fenceEvent(type, e) {
  if (!fenceOn()) { if (FD.drag) cancelSegment(); if (FDV.hot[0].visible && type === 'pointermove') showHot(0, null); return false; }
  const touch = e.pointerType !== 'mouse';
  if (type === 'pointerdown') {
    if (FD.drag) { if (e.pointerId !== FD.drag.id) cancelSegment(); return false; }   // (a second finger: a pinch, the camera's)
    if (e.target !== canvasEl || !e.isPrimary || e.button !== 0 || tool.gizmo.hovered || tool.gizmo.dragging) return false;
    const g = groundAt(e.clientX, e.clientY); if (!g) return false;
    const from = postNear(e.clientX, e.clientY, g, touch), a = from ? [from.x, from.z] : (snapOn() ? [snapHalf(g.x), snapHalf(g.z)] : [+g.x.toFixed(2), +g.z.toFixed(2)]);
    FD.drag = { id: e.pointerId, a, b: a, from, to: null };
    try { canvasEl.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
    controls.enabled = false; e.stopPropagation(); e.preventDefault();
    showHot(0, from); showSegment(a, a); tool.ring.visible = false;
    return true;
  }
  if (type === 'pointermove') {
    const g = groundAt(e.clientX, e.clientY); tool.ring.visible = false;
    if (!FD.drag) { showHot(0, e.target === canvasEl && g ? postNear(e.clientX, e.clientY, g, touch) : null); return true; }   // (hovering: the post a press would start from)
    if (e.pointerId !== FD.drag.id || !g) return true;
    const to = postNear(e.clientX, e.clientY, g, touch), ok = to && !(FD.drag.from && to.x === FD.drag.from.x && to.z === FD.drag.from.z);
    FD.drag.to = ok ? to : null; FD.drag.b = ok ? [to.x, to.z] : freeEnd(FD.drag.a, g);
    showHot(1, FD.drag.to); showSegment(FD.drag.a, FD.drag.b);
    return true;
  }
  if (type === 'pointerup' || type === 'pointercancel') {
    if (!FD.drag || e.pointerId !== FD.drag.id) return false;
    const d = FD.drag; cancelSegment();
    if (type === 'pointerup' && Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1]) >= FD.min) placeSegment(d);
    return true;
  }
  return false;
}
// (the tool's own handlers taken off the window and put back behind these)
for (const [type, key] of [['pointerdown', 'onDown'], ['pointermove', 'onMove'], ['pointerup', 'onUp'], ['pointercancel', 'onUp']]) {
  const own = tool[key]; removeEventListener(type, own, { capture: true });
  addEventListener(type, (e) => { if (!fenceEvent(type, e)) own(e); }, { capture: true });
}
addEventListener('keydown', (e) => { if (e.key === 'Escape' && FD.drag) { e.stopPropagation(); cancelSegment(); bar.setInfo('Fence segment let go.'); } }, true);
TL.fenceDraw = { posts: () => fencePosts().map((q) => [q.x, q.z]), drag: () => FD.drag && { a: FD.drag.a, b: FD.drag.b, from: !!FD.drag.from, to: !!FD.drag.to }, gap: FD.gap,
  hot: () => FDV.hot.map((h) => h.visible), label: () => (FDV.label.style.display === 'none' ? '' : FDV.label.textContent) };
// ── painted lawn, always to be seen ─────────────────────────────────────────────────────────────────────────────
// With the lawn picked and the view further off than the tufts are drawn, their circle stands round the brush; the stroke being
// painted shows its tufts as it goes; and the green tint shows all the painted lawn from any height
const lawnMap = makeLawnMap({ THREE, scene: V.scene, heightAt, PLANT });
TL.lawnMap = lawnMap;
let lawnKey = '', liveT = 0, lawnHas = false;   // (lawnHas: is any lawn painted (the tint's sheet has something to show))
const brushAt = { x: 0, z: 0 };   // (where the brush's ring was last drawn: the ring's own points are in the world, the line itself stays at the origin)
{ const show = tool.showRing.bind(tool); tool.showRing = (p, r, clear) => { brushAt.x = p.x; brushAt.z = p.z; show(p, r, clear); }; }
lawnNearBrush = () => {
  const s = bar.state, on = s.open && s.kind === PLANT.LAWN_KIND && s.mode !== 'select', G = V.LAWN_GO, st = tool.stroke, painting = on && st && st.mode === 'paint';
  const brush = on && tool.ring.visible ? brushAt : null, far = brush && Math.hypot(brush.x - camera.position.x, heightAt(brush.x, brush.z) - camera.position.y, brush.z - camera.position.z) > V.LAWN.radius * G.wide * 0.5;
  if (far) { if (!G.over) G.over = { x: brush.x, z: brush.z }; if (Math.hypot(brush.x - G.over.x, brush.z - G.over.z) > 4) { G.over.x = brush.x; G.over.z = brush.z; } } else if (G.over && (!on || brush)) { G.over = null; G.at.set(1e9, 0, 1e9); }   // (the pointer off the ground for a moment, over the bar: the tufts stay where they were)
  const now = performance.now();
  if (painting && now - liveT > 300) { liveT = now; G.live = { procedural: false, items: [], strokes: [{ ...st, pts: st.pts.slice() }] }; G.at.set(1e9, 0, 1e9); lawnMap.update(tool.planting.strokes, st); lawnHas = lawnMap.mesh.visible; lawnKey = ''; }
  else if (!painting && G.live) { G.live = null; G.at.set(1e9, 0, 1e9); }
  if (!painting) { const k = tool.planting.strokes.length + '|' + tool.planting.strokes.reduce((a, q) => a + (q.kind === PLANT.LAWN_KIND || q.mode === 'clear' ? q.pts.length : 0), 0); if (k !== lawnKey) { lawnKey = k; lawnMap.update(tool.planting.strokes); lawnHas = lawnMap.mesh.visible; } }
  // (the tint only while the lawn is picked: otherwise the lab looks as the game does, the game's maker's wish, 2026-11-10)
  lawnMap.mesh.visible = on && lawnHas;
};
PICKS.move();
TL.ready = true;
