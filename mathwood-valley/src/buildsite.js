// BUILD SITES: the places in the valley where the rider builds something with the builders' labs (the windmill's tower
// at the mill hill, the bridge over the western river, ...), IN the valley: no fade and no other scene. Meeting the
// person at a site (the miller, the engineer) and pressing E (or tapping the prompt) opens the site's builder right
// there: the camera glides from behind the rider to frame the site, the valley is still drawn round it and its sounds
// go on, the lab's own panel and handles come up over the game, and the rider stands by. "Done for now" (at the foot of
// the panel), Esc (with nothing in hand), or walking away (W, A, S or D held a moment with nothing in hand) puts the
// builder away: what was built is kept, and the camera glides back behind the rider.
//
//   const S = makeBuildSites({ W, camera, canvas, player, obstacles, onStart, onStop, onWork })
//     player(): the player (P); obstacles(): the things to hide while they stand between the camera and the site (the
//     player's person and horse, the dog); onStart() / onStop(): the game holds itself still while a builder is up
//     (the player and the keys let go, the HUD put away; main.js) and lets go again after; onWork(): the tools' Work it
//     out (src/ui/tools.js), or null: a "Work it out" button goes above "Done for now" (the HUD and its tools strip are
//     put away while a builder is up), for the card being asked (main.js reads the builder's question)
//   S.add(site) -> the site's record { id, origin, group, groundY }
//     site = { id, x, z (the middle of what is built: the site's own frame has its 0, 0 here, not turned: +Z is south),
//              prompt (the words by the person: 'Help the miller build his tower'), meet() -> { x, z } (where the
//              person stands now, or null), reach (m: how near the person E works, else SITE.meet),
//              css: [stylesheet urls, from the game's folder] (the lab's own sheet: on the page only while it is up),
//              mow: { r, fade } (optional, m: the ground round the middle mown like the town's yards, no tall meadow
//              over the stones or the foot of what is built; mowSite below),
//              mount(ctx) -> session (opens the builder; below), closed(how) (after it is put away: the job saves),
//              keepOut(x, z) (optional: true where the builder's own things move, the bridge's loads crossing: the
//              player's person, horse and dog standing there are hidden while the builder is up, as those in the
//              camera's way are) }
//     group: a THREE.Group in the valley's scene at the site's middle (on the ground there): the job puts what stands
//     at the site in it (the built tower, the stones); groundY(x, z): the valley's ground in the site's frame (metres)
//   S.prompt          the words for the prompt while the player is by a site's person (else null); S.talk() opens it
//   S.open(id), S.close(how)   ('done' | 'esc' | 'walk' | 'ride'); S.active: the open site's record, or null
//   S.update(dt)      each frame, AFTER the player has moved (it places the camera while a builder is up)
//   S.state(), S.dispose()
//
// ctx, given to a site's mount: { root (the element the builder's page goes in: an #app over the game), group,
//   origin (THREE.Vector3, world metres), groundY, camera, fit(viewRect) (the builder's view changed shape: the lens
//   follows), canvasRect() (the game's canvas on the page), leave(how) }
// session, from mount: { frame(dt) (points the camera), dispose(), busy() (a board in hand, a question or a test up:
//   walking away waits), panel (optional: the element "Done for now" goes at the foot of), resize() (optional) }
//
// THE CAMERA while a builder is up: the builder points it and sets its lens's width (fov). The view a builder draws in
// is the part of the screen right of its panel; the game's canvas still fills the screen, so the picture's middle is
// moved to the view's middle with the camera's view offset (three's setViewOffset), and the panel covers the rest.
// Opening and closing glide the camera (where it stands, which way it looks, its lens and that offset) over SITE.glide
// seconds; the builder's page fades in at the end of the glide in (its handles are placed for the camera it points).
//
// Also here: mergeStatic(roots, into), what stands at a site drawn in a few draw calls while no builder is up (one mesh
// for each material), and mowSite(W, x, z, { r, fade }) (above, S.add's `mow`).
// And levelAsker(rider, { most }) (from src/buildasker.js), the questions of a builder through the levels
// (src/levels/model.js, the place 'building') for a lab whose builder asks through an `asker` (labs/windmill/builder.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const SITE = {
  meet: 3.2,          // m from the site's person where E opens the builder
  glide: 1.3,         // s the camera glides from the rider to the site, and back
  fadeIn: 0.35,       // s the builder's page fades in, at the end of the glide in
  walkKeys: ['KeyW', 'KeyA', 'KeyS', 'KeyD'],   // held with nothing in hand: the rider walks away
  walkHold: 0.35,     // s one of them must be held (a tap to nudge a board's free end never leaves)
  clear: 0.9,         // m: a thing this near the line from the camera to what it looks at is hidden while there
  eye: 2.2,           // m: ...and one this near the camera itself (the rider's hat filling a corner of a phone's view)
  z: 30,              // the builder's page over the game (the HUD is put away; the lock box is 60)
};

const GAME = new URL('../', import.meta.url).href;
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export function makeBuildSites({ W, camera, canvas, player = () => null, obstacles = () => [], onStart = () => {}, onStop = () => {}, onWork = null }) {
  const S = { prompt: null, active: null };
  const sites = new Map();
  let near = null;            // the site whose person the player is by
  let open = null;            // { site, session, phase: 'dismount' | 'in' | 'on' | 'out', t, from, overlay, links, view, hidden }
  let back = null;            // the glide back behind the rider after closing: { t, from }
  const held = new Map();     // walking keys down: code -> since (s of open time)
  let clock = 0;

  S.add = (def) => {
    const y = W.heightAt(def.x, def.z), origin = new THREE.Vector3(def.x, y, def.z);
    const group = new THREE.Group(); group.name = 'site-' + def.id; group.position.copy(origin); W.scene.add(group);
    const site = { ...def, origin, group, groundY: (x, z) => W.heightAt(def.x + x, def.z + z) - y };
    site.unmow = def.mow ? mowSite(W, def.x, def.z, def.mow) : null;
    sites.set(def.id, site);
    return site;
  };

  // ── the lens: the picture's middle moved to the middle of the builder's view (k: 0 none .. 1 all the way) ─────────
  let viewRect = null, lensK = 0;
  function lens(k = lensK) {
    lensK = k;
    const c = canvas.getBoundingClientRect(), v = viewRect || c;
    const s = ((v.left + v.width / 2) - (c.left + c.width / 2)) * k;
    if (Math.abs(s) < 0.5) { camera.clearViewOffset(); camera.aspect = c.width / Math.max(1, c.height); }
    else {
      const F = c.width + 2 * Math.abs(s);
      camera.setViewOffset(F, c.height, s > 0 ? 0 : 2 * Math.abs(s), 0, c.width, c.height);
      camera.aspect = F / Math.max(1, c.height);
    }
    camera.updateProjectionMatrix();
  }

  // ── opening ──────────────────────────────────────────────────────────────────────────────────────────────────
  S.open = (id) => {
    const site = sites.get(id), P = player();
    if (!site || open || !P) return false;
    open = { site, phase: 'dismount', t: 0 };
    S.active = site; back = null;
    onStart();
    if (P.onHorse) P.dismount(); else begin();
    return true;
  };
  S.talk = () => (near ? S.open(near.id) : false);
  function begin() {
    const P = player(), site = open.site;
    open.phase = 'in'; open.t = 0;
    open.from = { pos: camera.position.clone(), quat: camera.quaternion.clone(), fov: camera.fov };
    if (P && P.cam) P.cam.enabled = false;
    if (P && P.cancelLasso) P.cancelLasso();
    // the lab's own stylesheet, while the builder is up (it is written for a page of its own: nothing in it clashes
    // with the game's, whose classes and ids all start with bm; it goes again with the builder)
    open.links = (site.css || []).map((href) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL(href, GAME).href; document.head.appendChild(l); return l; });
    const overlay = document.createElement('div'); overlay.className = 'bsite'; overlay.style.cssText = `position:fixed;inset:0;z-index:${SITE.z};opacity:0;pointer-events:none`;
    const root = document.createElement('div'); root.id = 'app'; overlay.appendChild(root); document.body.appendChild(overlay);
    open.overlay = overlay;
    ensureCss();
    const ready = Promise.all(open.links.map((l) => new Promise((res) => { l.onload = l.onerror = res; })));
    const me = open;
    ready.then(() => {
      if (open !== me) return;
      const ctx = { root, group: site.group, origin: site.origin, groundY: site.groundY, camera,
        // (the builder sets its lens's width, then says the view's shape: the glide eases toward that width)
        fit: (r) => { viewRect = r; me.fov = camera.fov; if (me.phase === 'in') camera.fov = me.from.fov + (me.fov - me.from.fov) * ease(me.t); lens(); }, canvasRect: () => canvas.getBoundingClientRect(), leave: (how) => S.close(how || 'done') };
      try { me.session = site.mount(ctx); } catch (e) { console.error('build site: the builder could not open', site.id, e); S.close('error'); return; }
      // "Done for now", at the foot of the builder's panel
      const panel = (me.session && me.session.panel) || root.querySelector('#panel') || overlay;
      const done = document.createElement('button'); done.type = 'button'; done.className = 'bsite-done'; done.textContent = 'Done for now';
      done.title = 'Put the builder away (Esc)'; done.onclick = () => S.close('done');
      // (Work it out above it: the card's sum in columns, or the entry to type one)
      if (typeof onWork === 'function') {
        const work = document.createElement('button'); work.type = 'button'; work.className = 'bsite-work';
        work.innerHTML = `${WORK_SVG}<span>Work it out</span>`; work.title = 'Work it out on paper: the sum on the card, or your own';
        work.onclick = (e) => { e.currentTarget.blur(); try { onWork(); } catch (err) { console.error(err); } };
        panel.appendChild(work); me.work = work;
      }
      panel.appendChild(done); me.done = done;
    });
  }

  // ── closing ──────────────────────────────────────────────────────────────────────────────────────────────────
  S.close = (how = 'done') => {
    if (!open) return false;
    const me = open, P = player(); open = null;
    const from = { pos: camera.position.clone(), quat: camera.quaternion.clone(), fov: camera.fov, k: lensK };
    if (me.session) { try { me.session.dispose(); } catch (e) { console.error('build site: the builder could not close cleanly', e); } }
    if (me.overlay) me.overlay.remove();
    for (const l of me.links || []) l.remove();
    showAll();
    held.clear(); S.active = null; viewRect = null;
    if (me.phase !== 'dismount') back = { t: 0, from, fov: me.from ? me.from.fov : 55 };
    if (P && P.cam) { P.cam.enabled = true; P.cam.snap(); }
    onStop();
    if (me.site.closed) { try { me.site.closed(how); } catch (e) { console.error('build site: closed', e); } }
    return true;
  };

  // ── walking away: a walking key held a moment with nothing in hand ───────────────────────────────────────────────
  const down = (e) => { if (open && SITE.walkKeys.includes(e.code) && !e.repeat && !held.has(e.code)) held.set(e.code, clock); };
  const up = (e) => { held.delete(e.code); };
  addEventListener('keydown', down); addEventListener('keyup', up);
  addEventListener('blur', () => held.clear());   // (a key let go while the window was away never says so)

  // ── things in the way: hidden while they stand between the camera and what it looks at ───────────────────────────
  const hidden = new Set(), ab = new THREE.Vector3(), ap = new THREE.Vector3(), look = new THREE.Vector3(), wp = new THREE.Vector3();
  function clearView(at) {
    const a = camera.position; ab.subVectors(at, a); const L2 = ab.lengthSq() || 1;
    for (const o of obstacles()) {
      if (!o) continue;
      o.getWorldPosition(wp); wp.y += 0.9;
      ap.subVectors(wp, a); const t = Math.max(0, Math.min(1, ap.dot(ab) / L2));
      const d = ap.addScaledVector(ab, -t).length();
      const inWay = (t < 0.92 && d < SITE.clear) || wp.distanceTo(a) < SITE.eye || !!(open && open.site.keepOut && open.site.keepOut(wp.x, wp.z));
      if (inWay && o.visible) { o.visible = false; hidden.add(o); } else if (!inWay && hidden.has(o)) { o.visible = true; hidden.delete(o); }
    }
  }
  function showAll() { for (const o of hidden) o.visible = true; hidden.clear(); }

  // ── each frame ───────────────────────────────────────────────────────────────────────────────────────────────
  const qa = new THREE.Quaternion();
  S.update = (dt) => {
    clock += dt;
    const P = player();
    // by a site's person: the prompt
    near = null; S.prompt = null;
    if (!open && P && (P.mode === 'foot' || P.mode === 'horse') && P.enabled !== false) {
      let bd = Infinity;
      for (const s of sites.values()) {
        const m = s.meet ? s.meet() : null; if (!m) continue;
        const d = Math.hypot(m.x - P.position.x, m.z - P.position.z);
        if (d < (s.reach || SITE.meet) && d < bd) { bd = d; near = s; }
      }
      if (near) S.prompt = near.prompt;
    }
    // the glide back behind the rider, after a builder was put away (the rider's camera has placed itself by now)
    if (back) {
      back.t += dt / SITE.glide;
      const e = ease(back.t);
      if (back.t >= 1) { camera.fov = back.fov; back = null; lens(0); }
      else {
        const to = { pos: camera.position.clone(), quat: camera.quaternion.clone() };
        camera.position.lerpVectors(back.from.pos, to.pos, e);
        camera.quaternion.slerpQuaternions(back.from.quat, to.quat, e);
        camera.fov = back.from.fov + (back.fov - back.from.fov) * e;
        lens(back.from.k * (1 - e));
        camera.updateMatrixWorld();
      }
    }
    if (!open) return;
    if (open.phase === 'dismount') {
      open.t += dt;
      if (P && P.mode === 'foot') begin();
      else if (open.t > 4 && (!P || P.mode !== 'dismounting')) S.close('error');   // (couldn't get down: never stuck)
      return;
    }
    const s = open.session;
    if (!s) return;   // (its stylesheet is still on its way)
    s.frame(dt);
    if (!open) return;   // (the frame itself put it away)
    if (open.phase === 'in') {
      open.t += dt / SITE.glide;
      const e = ease(open.t), f = open.from;
      const toFov = open.fov || camera.fov;
      if (open.t < 1) {
        camera.position.lerpVectors(f.pos, camera.position, e);
        qa.copy(camera.quaternion); camera.quaternion.slerpQuaternions(f.quat, qa, e);
        camera.fov = f.fov + (toFov - f.fov) * e;
        lens(e);
        camera.updateMatrixWorld();
      } else { open.phase = 'on'; camera.fov = toFov; lens(1); }
      // (the page fades in over the end of the glide; it takes touches once it is all there)
      const show = Math.max(0, Math.min(1, (open.t * SITE.glide - (SITE.glide - SITE.fadeIn)) / SITE.fadeIn));
      open.overlay.style.opacity = String(show);
      open.overlay.style.pointerEvents = show >= 1 ? '' : 'none';
    } else if (lensK !== 1) lens(1);
    // walking away
    if (open.phase === 'on' && !(s.busy && s.busy())) {
      for (const since of held.values()) if (clock - since >= SITE.walkHold) { S.close('walk'); return; }
    }
    camera.getWorldDirection(look); look.multiplyScalar(6).add(camera.position);
    clearView(look.set(open.site.origin.x, Math.max(open.site.origin.y + 1, look.y), open.site.origin.z));
  };

  S.state = () => ({ open: open ? { id: open.site.id, phase: open.phase, t: open.t, ready: !!open.session } : null, back: !!back, prompt: S.prompt, near: near && near.id, lens: lensK,
    sites: [...sites.values()].map((s) => ({ id: s.id, x: s.x, z: s.z, meet: s.meet ? s.meet() : null })) });
  S.dispose = () => {
    if (open) S.close('ride');
    back = null; lens(0);
    removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', up);
    for (const s of sites.values()) { W.scene.remove(s.group); if (s.unmow) s.unmow(); }
    sites.clear();
  };
  return S;
}

// The ground round a site mown like the town's yards (the meadow's tall plants and lawn tufts kept off a circle r m
// round x, z, easing back over `fade` m), as the bottle range mows its ground (src/range.js). -> a function that puts
// the meadow back
export function mowSite(W, x, z, { r = 6, fade = 3 } = {}) {
  const V = W.V, T = V && V.TOWN;
  if (!T || !T.yard || !V.N || !V.TEX) return () => {};
  const N = V.N, TEX = V.TEX, SIZE = V.SIZE, old = new Map(), R = r + fade + TEX;
  for (let j = Math.max(0, Math.floor((z - R + SIZE / 2) / TEX)); j <= Math.min(N - 1, Math.ceil((z + R + SIZE / 2) / TEX)); j++)
    for (let i = Math.max(0, Math.floor((x - R + SIZE / 2) / TEX)); i <= Math.min(N - 1, Math.ceil((x + R + SIZE / 2) / TEX)); i++) {
      const d = Math.hypot((i + 0.5) * TEX - SIZE / 2 - x, (j + 0.5) * TEX - SIZE / 2 - z), f = Math.min(1, Math.max(0, d - r) / Math.max(0.01, fade)), y = 1 - f * f * (3 - 2 * f);
      const k = j * N + i; if (y > T.yard[k]) { old.set(k, T.yard[k]); T.yard[k] = y; }
    }
  const forget = () => { const cc = V.COVER && V.COVER.cache; if (cc && cc.tiles) cc.tiles.clear(); };
  forget();
  const bare = V.LAWN_SKIP ? (px, pz) => Math.hypot(px - x, pz - z) < r + fade * 0.5 : null;
  if (bare) { V.LAWN_SKIP.push(bare); if (V.placeLawn) V.placeLawn(); }
  return () => { for (const [k, v] of old) T.yard[k] = v; if (bare) { const i = V.LAWN_SKIP.indexOf(bare); if (i >= 0) V.LAWN_SKIP.splice(i, 1); if (V.placeLawn) V.placeLawn(); } forget(); };
}

// What stands at a site, cheap to draw: every visible plain mesh under `roots` (the lab's own drawing: a board a mesh)
// merged into one mesh for each material (and each kind of geometry: they must carry the same attributes), in the
// frame of `into` (the site's group), added to it. Instanced, skinned and other meshes, sprites and lines are left as
// they are. The meshes merged are hidden meanwhile. -> { group (the merged meshes), count (meshes merged), draws,
// undo() (the merged meshes taken away and disposed, the originals shown again) }
export function mergeStatic(roots, into) {
  into.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(into.matrixWorld).invert(), m = new THREE.Matrix4();
  const lots = new Map(), hidden = [];
  const seen = (o) => { for (let q = o; q; q = q.parent) { if (!q.visible) return false; if (roots.includes(q)) return true; } return true; };
  for (const root of roots) {
    if (!root) continue;
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || !seen(o)) return;
      const g = o.geometry, sig = Object.keys(g.attributes).sort().join(',') + (g.index ? '|i' : '');
      const key = o.material.uuid + '|' + sig;
      if (!lots.has(key)) lots.set(key, { mat: o.material, list: [], cast: false, receive: false });
      const lot = lots.get(key);
      const c = g.clone(); c.applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
      for (const k of Object.keys(c.morphAttributes)) delete c.morphAttributes[k];
      lot.list.push(c); lot.cast = lot.cast || o.castShadow; lot.receive = lot.receive || o.receiveShadow;
      hidden.push(o);
    });
  }
  const group = new THREE.Group(); group.name = 'merged';
  let count = 0;
  for (const lot of lots.values()) {
    const g = lot.list.length === 1 ? lot.list[0] : mergeGeometries(lot.list, false);
    if (lot.list.length > 1) for (const c of lot.list) c.dispose();
    if (!g) continue;
    const mesh = new THREE.Mesh(g, lot.mat); mesh.castShadow = lot.cast; mesh.receiveShadow = lot.receive; mesh.matrixAutoUpdate = false;
    group.add(mesh); count += lot.list.length;
  }
  for (const o of hidden) o.visible = false;
  into.add(group);
  return { group, count, draws: group.children.length,
    undo() { into.remove(group); for (const c of group.children) c.geometry.dispose(); for (const o of hidden) o.visible = true; hidden.length = 0; } };
}

// The game's own touch on the builder's page: "Work it out" and the "Done for now" button at the foot of the lab's panel
const WORK_SVG = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="4" width="22" height="25" rx="2" fill="#f6edd6" stroke="#6b4614" stroke-width="1.6"/><path d="M9 11h9M9 16h9M9 21h13" stroke="#8a7558" stroke-width="1.4"/><path d="M9 23.5h13" stroke="#2b2219" stroke-width="1.6"/></svg>';
function ensureCss() {
  if (document.getElementById('bsite-css')) return;
  const st = document.createElement('style'); st.id = 'bsite-css';
  st.textContent = `
.bsite #c { display: none; }
.bsite #view { background: transparent; }
.bsite-done { flex: none; margin-top: auto; align-self: stretch; padding: 9px 10px; border-radius: 8px; border: 1px solid #6d4a17; cursor: pointer;
  background: linear-gradient(#e7b65a, #c4882e); color: #2a1a08; font: 600 15px Bitter, Georgia, serif; box-shadow: 0 2px 0 #2a1c10; }
.bsite-done:hover { background: linear-gradient(#f3c56b, #d39837); }
@media (max-width: 700px) { .bsite-done { font-size: 13px; padding: 8px 4px; } }
.bsite-work { flex: none; margin-top: auto; align-self: stretch; display: flex; align-items: center; justify-content: center; gap: 7px; padding: 7px 10px;
  border-radius: 8px; border: 1px solid rgba(226, 173, 76, 0.55); cursor: pointer; background: rgba(30, 20, 12, 0.82); color: #f3c56b;
  font: 700 15px Bitter, Georgia, serif; }
.bsite-work svg { width: 24px; height: 24px; flex: none; }
.bsite-work:hover { border-color: #e2ad4c; background: rgba(48, 32, 18, 0.9); }
.bsite-work + .bsite-done { margin-top: 6px; }
@media (max-width: 700px) { .bsite-work { font-size: 13px; padding: 6px 4px; } .bsite-work svg { width: 20px; height: 20px; } }
`;
  document.head.appendChild(st);
}

// The questions of a builder: src/buildasker.js levelAsker (the windmill and the bridge are one place on the levels
// ladder, 'building'), re-exported here for the jobs.
export { levelAsker } from './buildasker.js';
