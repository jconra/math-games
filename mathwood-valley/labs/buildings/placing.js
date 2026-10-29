// PLACE THINGS: the player's cabin's things in the Building Lab's cabin, where the game puts them (src/cabin/layout.js:
// worked out from the design, the game maker's own spots winning), made by the game's own code (src/cabin/things.js),
// and moved by hand: drag a wall thing along its wall (or onto another wall), a floor thing across the floor; Save
// writes models/cabin/placement.json (src/cabin/placement.js), which the game reads as the cabin loads, so a reload of
// the game shows the spot. A spot over a window or a doorway, standing in a doorway's way, on the hearth, in another
// thing... is outlined red and listed in the panel (layout.js checkLayout), as the game's own placing would never put it.
//
// Controls (the lab's own: one panel; the view drags round as ever): drag a thing with the mouse or a finger; R (or the
// Turn button) turns the chosen floor thing a quarter; WASD flies the camera about the cabin (Space up, C down), the
// chosen thing kept in view. Phones: a finger drags a thing; two fingers or a drag on the room turn the view.
//
//   const PL = makePlacing({ scene, camera, controls, canvas, base, building: () => B, recipe: () => cabin recipe,
//                            view: (name) => {}, onChange: () => {} })
//   PL.panelHTML()        the "Place things" section of the cabin's panel;  PL.wire(panel) after the panel is drawn
//   PL.on                 shown and draggable;  PL.set(on)
//   PL.rebuilt()          the cabin was built again (another design): its things made anew
//   PL.tick(dt)           each frame (the WASD flying)
//   PL.state()            for the rigs: the design's key, the spots, the problems, the chosen thing
//   PL.drag(id, at)       for the rigs: move a thing as a drag to a point would ({ x, y, z } in the cabin's frame)
//   PL.save()             -> 'server' | 'download'
//
// THE FIRES: with the lab's lanterns and fires lit, a cabin's fireplaces burn with the game's own fire (src/cabin/
// hearthfire.js: its flame, its embers, its light on the walls through the lab's lamps), whether Place things is on or not.
import * as THREE from 'three';
import { cabinLayout, withSpots, placementKey, THINGS, KEEP_RECT } from '../../src/cabin/layout.js';
import { SLOTS } from '../../src/cabin/slots.js';
import { KEEPSAKES } from '../../src/save.js';
import { makeThings } from '../../src/cabin/things.js';
import { loadPlacement, spotsFor, placementText, PLACEMENT_FILE } from '../../src/cabin/placement.js';
import { PRESETS } from './cabins.js';
import { makeHearthFire } from '../../src/cabin/hearthfire.js';
import { lookOf } from '../../world/objects/codebuild.js';
import { PLAYER_CABIN } from '../../world/objects/codebuildings.js';

const SAVE_URL = 'http://127.0.0.1:8998/cabin-placement';
const LOCAL = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
const NAME = { ...Object.fromEntries(Object.entries(KEEPSAKES).map(([k, v]) => [k, v.name])), ...Object.fromEntries(SLOTS.map((s) => [s.id, s.name])) };
const D2R = Math.PI / 180;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function makePlacing({ scene, camera, controls, canvas, base, building, recipe, view = () => {}, onChange = () => {}, lamps = () => false, lampUniform = null, setDesign = null }) {
  const root = new THREE.Group(); root.name = 'cabin-things'; root.visible = false; scene.add(root);
  const marks = new THREE.Group(); marks.name = 'cabin-things-marks'; scene.add(marks);
  let on = false, A = null, auto = null, Lay = null, key = '', file = { v: 1, spots: {} }, edits = {}, savedText = '', chosen = null, built = 0, panel = null, status = '';
  const TH = makeThings({ base, floorUnder: () => (A ? A.floor : 0) });
  const holders = new Map();   // id -> { holder (its transform from where it was made to where it is), group, made: spot it was made at }

  // ── THE THINGS, made where the layout says ──
  const specOf = (L, id) => { const s = SLOTS.find((q) => q.id === id); return s ? { ...s, ...(L.slots[id] || {}), box: (L.slots[id] && 'box' in L.slots[id]) ? L.slots[id].box : s.box } : null; };
  const spotOf = (L, id) => (THINGS.find((t) => t.id === id && t.of === 'keepsake') ? L.keepsakes[id] : L.slots[id]);
  // a spot's frame: where it is and which way it faces (a wall thing: into the room, off the wall's face)
  const frameOf = (id, s) => {
    if (!s) return new THREE.Matrix4();
    if (id === 'dogbeds') { const q = s.spots ? s.spots[0] : { x: s.at[0], z: s.at[2] }; return new THREE.Matrix4().makeTranslation(q.x, 0, q.z); }
    if (s.wall) return new THREE.Matrix4().compose(new THREE.Vector3(s.at[0], s.at[1], s.at[2]), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-s.wall[0], -s.wall[2])), new THREE.Vector3(1, 1, 1));
    return new THREE.Matrix4().compose(new THREE.Vector3(s.at[0], 0, s.at[2]), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (s.rot || 0) * D2R), new THREE.Vector3(1, 1, 1));
  };
  const clear = () => {
    for (const h of holders.values()) { h.holder.removeFromParent(); h.holder.traverse((o) => { if (o.geometry && o.userData.made !== false) o.geometry.dispose(); }); }
    holders.clear(); for (const m of [...marks.children]) { marks.remove(m); m.geometry.dispose(); m.material.dispose(); }
  };
  async function make() {
    const B = building(); if (!B || !B.anchors || !B.anchors.rooms) return;
    const my = ++built;
    A = B.anchors; const r = recipe() || {};
    key = placementKey({ preset: r.preset, seed: r.seed }, PRESETS);
    file = await loadPlacement(base, { fresh: true }); if (my !== built) return;
    edits = { ...(spotsFor(file, key) || {}) }; savedText = JSON.stringify(edits);
    auto = cabinLayout(A); Lay = withSpots(A, auto, edits);
    clear();
    const add = (id, g) => { const holder = new THREE.Group(); holder.matrixAutoUpdate = false; holder.add(g); holder.userData.thing = id; root.add(holder); holders.set(id, { holder, made: JSON.parse(JSON.stringify(spotOf(Lay, id) || null)) }); };
    // the furniture (every slot: bought in the game one by one), the dog beds all three
    for (const s of SLOTS) {
      if (s.id === 'porch' && !A.porch) continue;
      const g = await TH.build(s.id, specOf(Lay, s.id), { dogs: 3, bedSpots: Lay.bedSpots }); if (my !== built) return;
      add(s.id, g);
    }
    // the keepsakes, every one at its best buckle (the wanted posters all four)
    for (const job of Object.keys(KEEPSAKES)) { const g = TH.keepsake(job, 'gold', Lay.keepsakes[job], { table: true }); if (g) { const w = new THREE.Group(); w.add(g); add(job, w); } }
    place(); show();
  }
  // every thing where its spot is now (moved from where it was made)
  const _m = new THREE.Matrix4();
  function place() {
    for (const [id, h] of holders) {
      const now = spotOf(Lay, id);
      if (id === 'dogbeds' || id === 'lanterns' || id === 'porch') { h.holder.matrix.identity(); }
      if (id === 'dogbeds' && h.made && now) { const a = h.made.spots[0], b = now.spots[0]; h.holder.matrix.makeTranslation(b.x - a.x, 0, b.z - a.z); }
      else if (id !== 'lanterns' && id !== 'porch' && h.made && now) h.holder.matrix.multiplyMatrices(frameOf(id, now), _m.copy(frameOf(id, h.made)).invert());
      h.holder.matrixWorldNeedsUpdate = true;
    }
    marksDraw();
  }
  // the red outlines round what's wrong, a yellow one round the chosen thing
  function marksDraw() {
    for (const m of [...marks.children]) { marks.remove(m); m.geometry.dispose(); m.material.dispose(); }
    if (!on || !Lay) return;
    const bad = new Set(Lay.checks.map((c) => c.id));
    for (const [id, h] of holders) {
      if (!bad.has(id) && id !== chosen) continue;
      h.holder.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(h.holder); if (box.isEmpty()) continue;
      const helper = new THREE.Box3Helper(box.expandByScalar(0.03), bad.has(id) ? 0xff2a1a : 0xffd23a); helper.material.depthTest = false; helper.renderOrder = 30; marks.add(helper);
    }
  }

  // ── DRAGGING ──
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
  let drag = null;   // { id, kind, pointer, grabU / grab offset }
  const kindOf = (id) => (THINGS.find((t) => t.id === id) || { kind: null }).kind;
  const pointerRay = (e) => { const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray; };
  const thingAt = (e) => {
    pointerRay(e);
    const hits = ray.intersectObjects([...holders.values()].filter((h) => kindOf(h.holder.userData.thing)).map((h) => h.holder), true);
    for (const x of hits) { let o = x.object; while (o && !o.userData.thing) o = o.parent; if (o && o.visible) return o.userData.thing; }
    return null;
  };
  // the wall (of the layout's) a ray meets first from inside, and where: { w, u, v }
  function wallHit(r) {
    let best = null;
    for (const w of auto.walls) {
      const n = w.dir, d = r.direction, o = r.origin, dn = d.x * n[0] + d.z * n[2]; if (dn <= 1e-4) continue;   // (facing it from inside)
      const t = w.axis === 'x' ? (w.at - o.z) / d.z : (w.at - o.x) / d.x; if (!(t > 0)) continue;
      const p = o.clone().addScaledVector(d, t), u = w.axis === 'x' ? p.x : p.z;
      if (u < w.a0 - 0.05 || u > w.a1 + 0.05 || p.y < w.y - 0.05 || p.y > w.room.ceil + 0.05) continue;
      if (!best || t < best.t) best = { t, w, u, v: p.y };
    }
    return best;
  }
  const floorHit = (r) => { const t = (A.floor - r.origin.y) / r.direction.y; if (!(t > 0)) return null; return r.origin.clone().addScaledVector(r.direction, t); };
  // a wall thing's height: its own (the layout's) unless dragged well off it
  const HANGS = { cattle: 2.05, rifles: 1.42, deliveries: 2.2, sheep: 1.62, bandits: 1.48, fish: 1.6, picture: 1.62, pigs: 1.42, targets: 1.42, loads: 1.42, tower: 1.36 };
  function moveTo(id, r) {
    const k = kindOf(id), now = spotOf(Lay, id); if (!k || !now) return;
    if (k === 'wall') {
      const h = wallHit(r); if (!h) return;
      const rc = KEEP_RECT[id].map((q) => q * (now.scale || 1)), w = h.w;
      let u = h.u - (drag ? drag.du : 0), v = h.v - (drag ? drag.dv : 0);
      u = Math.max(w.a0 - rc[0] + 0.02, Math.min(w.a1 - rc[1] - 0.02, u));
      const vDef = A.floor + (HANGS[id] || 1.5) - (rc[2] + rc[3]) / 2;
      if (Math.abs(v - vDef) < 0.12) v = vDef;   // (snaps to its own height)
      v = Math.max(A.floor + 0.25 - rc[2], Math.min(w.room.ceil - 0.08 - rc[3], v));
      const at = w.axis === 'x' ? [u, v, w.at] : [w.at, v, u];
      edits[id] = { at: at.map((q) => +q.toFixed(2)), wall: w.dir.slice(), ...(now.scale ? { scale: now.scale } : {}) };
    } else {
      const p = floorHit(r); if (!p) return;
      let x = Math.round((p.x - (drag ? drag.dx : 0)) * 20) / 20, z = Math.round((p.z - (drag ? drag.dz : 0)) * 20) / 20;
      if (id === 'dogbeds') {
        const sp = now.spots, dx = x - sp[0].x, dz = z - sp[0].z;
        edits[id] = { spots: sp.map((q) => ({ x: +(q.x + dx).toFixed(2), z: +(q.z + dz).toFixed(2), rot: q.rot })) };
      } else if (id === 'boxes' || id === 'loot') {
        // (they stand against a wall: back to the nearest one within reach, facing away from it)
        const near = auto.walls.filter((w) => (w.axis === 'x' ? x : z) > w.a0 && (w.axis === 'x' ? x : z) < w.a1).map((w) => ({ w, d: Math.abs((w.axis === 'x' ? z : x) - w.at) })).sort((a, b) => a.d - b.d)[0];
        let rot = now.rot || 0;
        if (near && near.d < 0.8) { const w = near.w, back = id === 'boxes' ? 0.17 : 0.27; if (w.axis === 'x') z = w.at - w.dir[2] * back; else x = w.at - w.dir[0] * back; rot = Math.round(Math.atan2(-w.dir[0], -w.dir[2]) / D2R); }
        edits[id] = { at: [x, null, z], rot };
      } else edits[id] = { at: [x, null, z], rot: now.rot || 0 };
    }
    Lay = withSpots(A, auto, edits); place(); onChange(); panelDraw();
  }
  function turn(id = chosen) {
    if (!id || kindOf(id) !== 'floor' || id === 'dogbeds' || id === 'boxes' || id === 'loot') return;
    const now = spotOf(Lay, id); if (!now) return;
    edits[id] = { at: [now.at[0], null, now.at[2]], rot: id === 'table' ? (now.rot === 90 ? 0 : 90) : (((now.rot || 0) + 90) % 360) };
    Lay = withSpots(A, auto, edits);
    // (the table's chairs go round with it: made again)
    if (id === 'table') remake('table'); else place();
    panelDraw();
  }
  async function remake(id) {
    const h = holders.get(id); if (!h) return;
    const g = await TH.build(id, specOf(Lay, id), { dogs: 3, bedSpots: Lay.bedSpots });
    h.holder.clear(); h.holder.add(g); h.made = JSON.parse(JSON.stringify(spotOf(Lay, id))); place();
  }
  function down(e) {
    if (!on || e.button > 0) return;
    const id = thingAt(e); if (!id) return;
    e.stopImmediatePropagation(); e.preventDefault();
    chosen = id; controls.enabled = false;
    // (where on it it was taken hold of, so it doesn't jump to the pointer)
    const r = pointerRay(e), s = spotOf(Lay, id); drag = { id, pid: e.pointerId, du: 0, dv: 0, dx: 0, dz: 0 };
    if (kindOf(id) === 'wall') { const h = wallHit(r); if (h && s.wall) { drag.du = h.u - (h.w.axis === 'x' ? s.at[0] : s.at[2]); drag.dv = h.v - s.at[1]; } }
    else { const p = floorHit(r), q = id === 'dogbeds' ? { x: s.spots[0].x, z: s.spots[0].z } : { x: s.at[0], z: s.at[2] }; if (p) { drag.dx = p.x - q.x; drag.dz = p.z - q.z; } }
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* (a synthetic event) */ }
    marksDraw(); panelDraw();
  }
  function move(e) { if (!drag || e.pointerId !== drag.pid) return; e.stopImmediatePropagation(); moveTo(drag.id, pointerRay(e)); }
  function up(e) { if (!drag || e.pointerId !== drag.pid) return; e.stopImmediatePropagation(); drag = null; controls.enabled = true; try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* (gone) */ } }
  canvas.addEventListener('pointerdown', down, { capture: true });
  canvas.addEventListener('pointermove', move, { capture: true });
  canvas.addEventListener('pointerup', up, { capture: true });
  canvas.addEventListener('pointercancel', up, { capture: true });

  // ── FLYING: WASD, Space up, C down (the orbit's centre moved with the camera) ──
  const keys = new Set();
  const typing = () => { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA'); };
  addEventListener('keydown', (e) => {
    if (!on || typing() || e.ctrlKey || e.metaKey) return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyC'].includes(e.code)) { keys.add(e.code); e.preventDefault(); }
    if (e.code === 'KeyR') turn();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  const fwd = new THREE.Vector3(), side = new THREE.Vector3(), step = new THREE.Vector3();
  // ── THE FIRES (the game's own: hearthfire.js), through a stand-in for the game's cabin and valley ──
  let fires = [], fireB = null, fireT = 0;
  const Wlab = { scene, tier: 'gaming', heightAt: () => 0 };
  function firesTick(dt) {
    const B = building(), want = !!(B && B.anchors && B.anchors.hearths && B.anchors.hearths.length && lamps());
    if (fireB !== B || (!want && fires.length)) { for (const F of fires) F.dispose(); fires = []; fireB = B; }
    if (want && !fires.length) {
      const R = { group: scene, inner: scene, toWorld: (x, y, z, o = new THREE.Vector3()) => o.set(x, y, z), code: { lamps: B.lamps, uni: lampUniform ? { uLampS: lampUniform } : null }, extraLamps: [] };
      fires = cabinLayout(B.anchors).hearths.map((h, i) => { const F = makeHearthFire({ W: Wlab, R, camera, hearth: h, index: i }); F.light(); return F; });
    }
    fireT += dt;
    for (const F of fires) { F.update(dt, fireT); if (F.phase === 'dying' || F.phase === 'embers') F.light(); }
  }
  function tick(dt) {
    firesTick(dt);
    if (!on || !keys.size) return;
    camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize(); side.crossVectors(fwd, camera.up).normalize();
    step.set(0, 0, 0);
    if (keys.has('KeyW')) step.add(fwd); if (keys.has('KeyS')) step.sub(fwd);
    if (keys.has('KeyD')) step.add(side); if (keys.has('KeyA')) step.sub(side);
    if (keys.has('Space')) step.y += 1; if (keys.has('KeyC')) step.y -= 1;
    if (!step.lengthSq()) return;
    step.normalize().multiplyScalar(2.2 * dt);
    camera.position.add(step); controls.target.add(step); controls.update();
  }

  // ── YOUR CABIN IN THE GAME: the design the town builds for the player's cabin (its layout item and decor.json: the
  // preset, and the seed it has or its id gives it: world/objects/codebuild.js lookOf), so the spots saved are its own ──
  async function gameLook() {
    const get = (f) => fetch(new URL(`models/town/${f}.json`, base).href, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const [lay, dec] = await Promise.all([get('layout'), get('decor')]);
    const it = { ...(((lay && lay.items) || []).find((i) => i.id === 'cabin') || {}), ...((dec && dec.moved && dec.moved.cabin) || {}) };
    return lookOf('cabin', { id: 'cabin', preset: it.preset || PLAYER_CABIN, seed: it.seed });
  }
  let game = null;   // { preset, seed } once known
  async function toGame() {
    game = game || await gameLook();
    const r = recipe() || {};
    if (setDesign && (r.preset !== game.preset || +r.seed !== +game.seed)) { setDesign({ ...PRESETS[game.preset], preset: game.preset, seed: game.seed }); return true; }
    return false;
  }
  const isGame = () => { const r = recipe() || {}; return !!game && r.preset === game.preset && +r.seed === +game.seed; };

  // ── SAVING ──
  const dirty = () => JSON.stringify(edits) !== savedText;
  const fileNow = () => { const f = { v: 1, spots: { ...(file.spots || {}) } }; if (Object.keys(edits).length) f.spots[key] = edits; else delete f.spots[key]; return f; };
  const download = (text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = 'placement.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
  async function save({ downloadOnly = false } = {}) {
    const f = fileNow(), text = placementText(f);
    if (LOCAL && !downloadOnly) {
      try { const r = await fetch(SAVE_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: text });
        if (r.ok) { file = f; savedText = JSON.stringify(edits); status = `Saved into the game (${PLACEMENT_FILE}). Reload the game to see it.`; panelDraw(); return 'server'; } } catch (e) { /* (the save script isn't running: downloaded instead) */ }
    }
    download(text); file = f; savedText = JSON.stringify(edits);
    status = LOCAL ? 'The save script isn\'t running (node ~/pw/bandit-math/rigs/town/save_server.cjs): downloaded placement.json instead.' : 'Downloaded placement.json: hand it over to put it in the game.';
    panelDraw(); return 'download';
  }

  // ── THE PANEL: one section of the lab's own ──
  const panelHTML = () => `<details class="sec" id="plSec"${on ? ' open' : ''}><summary>Place things</summary><div class="body">
    <div class="row check"><label><input type="checkbox" id="plOn"${on ? ' checked' : ''}> Show the player's things (every piece bought, every keepsake earned) and move them</label></div>
    <div id="plBody"></div></div></details>`;
  function panelDraw() {
    if (!panel) return;
    const el = panel.querySelector('#plBody'); if (!el) return;
    if (!on) { el.innerHTML = '<p class="note">Where the game puts them in your cabin: worked out from this design, kept off the windows, doorways and the hearth. Turn it on to drag a keepsake along its wall or a piece across the floor.</p>'; return; }
    const probs = Lay ? Lay.checks : [], own = Object.keys(edits);
    el.innerHTML = `<p class="note">Drag a thing to move it (a wall thing along its wall or onto another; a floor thing across the floor). <b>R</b> or Turn turns the chosen floor thing. <b>WASD</b> flies the camera (Space up, C down). Red: over a window or doorway, in a doorway's way, on the hearth, or in something else.</p>
      <div class="lbl">${isGame() ? 'Your cabin, as the game builds it' : 'Not your cabin in the game: another design'} (${esc(key)})${own.length ? ` · ${own.length} spot${own.length === 1 ? '' : 's'} of your own` : ' · all worked out by the game'}</div>
      ${isGame() ? '' : '<div class="picks"><button class="btn" id="plGame">Your cabin in the game</button></div>'}
      ${chosen ? `<div class="row two"><span>Chosen: <b>${esc(NAME[chosen] || chosen)}</b>${edits[chosen] ? ' (your spot)' : ''}</span><span>${kindOf(chosen) === 'floor' && !['dogbeds', 'boxes', 'loot'].includes(chosen) ? '<button class="btn" id="plTurn">Turn</button> ' : ''}${edits[chosen] ? '<button class="btn" id="plBack">Game\'s spot</button>' : ''}</span></div>` : ''}
      ${probs.length ? `<ul class="plprobs" style="color:#ff8a7a;margin:6px 0 6px 18px;padding:0">${probs.map((p) => `<li>${esc(NAME[p.id] || p.id)}: ${esc(p.what)}</li>`).join('')}</ul>` : '<p class="note" style="color:#9fdc8a">Everything clear of the windows, doorways and hearth.</p>'}
      <div class="picks"><button class="btn" id="plSave"${dirty() ? '' : ''}>Save</button><button class="btn" id="plAll">All the game's spots</button><button class="btn" id="plView">Look in</button></div>
      <p class="note" id="plStatus">${esc(status || (dirty() ? 'Not saved yet.' : own.length ? 'Saved.' : ''))}</p>`;
    const $ = (s) => el.querySelector(s);
    if ($('#plTurn')) $('#plTurn').onclick = () => turn();
    if ($('#plBack')) $('#plBack').onclick = () => { const id = chosen; delete edits[id]; Lay = withSpots(A, auto, edits); if (id === 'table') remake('table'); else place(); panelDraw(); };
    $('#plAll').onclick = () => { if (!Object.keys(edits).length || confirm('Put every thing back where the game would put it? (Save keeps that.)')) { edits = {}; Lay = withSpots(A, auto, edits); remake('table'); place(); panelDraw(); } };
    $('#plSave').onclick = () => save();
    $('#plView').onclick = () => view('room');
    if ($('#plGame')) $('#plGame').onclick = () => toGame();
  }
  function show() { root.visible = on; marksDraw(); panelDraw(); }
  async function set(v) {
    on = !!v; status = '';
    // (turned on: the player's cabin as the game builds it, unless it's showing already; the cabin built again then
    // makes the things: rebuilt)
    if (on && await toGame()) { show(); onChange(); return; }
    if (on && (!Lay || !holders.size)) await make();
    show(); onChange();
    if (on) view('room');
  }
  function wire(p) {
    panel = p; const c = p.querySelector('#plOn'); if (c) c.onchange = (e) => set(e.target.checked);
    panelDraw();
  }
  return {
    get on() { return on; }, set, panelHTML, wire, tick, save, turn,
    rebuilt() { Lay = null; clear(); if (on) make(); else panelDraw(); },
    off() { if (on) { on = false; show(); } },
    state: () => ({ on, key, edits: JSON.parse(JSON.stringify(edits)), problems: Lay ? Lay.checks.slice() : [], chosen, things: [...holders.keys()], spots: Lay ? Object.fromEntries(THINGS.map((t) => [t.id, spotOf(Lay, t.id)])) : null }),
    // (for the rigs: drag a thing to a point, as a pointer over it would)
    drag(id, p) {
      chosen = id; const o = new THREE.Vector3(p.x, p.y, p.z), k = kindOf(id);
      // (a ray toward the point: from the room's middle for a wall thing, from above for a floor thing)
      const r = k === 'wall' ? new THREE.Ray(new THREE.Vector3((auto.main.x0 + auto.main.x1) / 2, p.y, (auto.main.z0 + auto.main.z1) / 2), new THREE.Vector3()) : new THREE.Ray(new THREE.Vector3(p.x, A.floor + 3, p.z), new THREE.Vector3(0, -1, 0));
      if (k === 'wall') { const room = auto.walls.map((w) => w.room).find((q) => p.x >= q.x0 - 0.05 && p.x <= q.x1 + 0.05 && p.z >= q.z0 - 0.05 && p.z <= q.z1 + 0.05) || auto.main; r.origin.set((room.x0 + room.x1) / 2, p.y, (room.z0 + room.z1) / 2); r.direction.copy(o).sub(r.origin).normalize(); }
      drag = null; moveTo(id, r); return spotOf(Lay, id);
    },
    get layout() { return Lay; }, root,
  };
}
