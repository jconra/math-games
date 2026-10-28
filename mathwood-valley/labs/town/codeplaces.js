// THE GAME'S OWN THINGS, SHOWN IN THE TOWN LAB: what the game puts down in code rather than from the layout (the farm with
// its barn, pens and windmill; the homestead behind the player's cabin: the coop, the pig pen, the corral; the windmill
// job's mill hill; the target range; the jobs board), drawn as outlines on the ground with their names over them, so
// the town can be laid out round them. Lab only: nothing here is in the game. The homestead follows the player's cabin
// as it is moved (it is laid out from the cabin's back wall, src/homestead.js).
//   const CP = makeCodePlaces({ scene, heightAt, cabin: () => item | null, farm: () => place })
//   CP.update()     now and then (the homestead redrawn when the cabin has moved)
//   CP.show(on)     CP.shown
//   CP.list()       for rigs: [{ name, x, z }]
import * as THREE from 'three';

const COL = { farm: 0xffd34d, homestead: 0x7ee0ff, mill: 0xff9a4d, range: 0xff6a6a, board: 0xd9a0ff };

// a module of the game's, read for its layout; one that won't load is left out (said once)
const tryImport = (p) => import(p).catch((e) => { console.warn('town lab: could not read', p, e.message); return null; });

export async function makeCodePlaces({ scene, heightAt, cabin = () => null, farm = () => null }) {
  const [F, H, R, LF, JB] = await Promise.all(['../../src/farm.js', '../../src/homestead.js', '../../src/range.js', '../../world/objects/landforms.js', '../../src/jobsboard.js'].map(tryImport));
  const group = new THREE.Group(); group.name = 'code-places'; scene.add(group);
  const parts = { fixed: new THREE.Group(), yard: new THREE.Group() }; group.add(parts.fixed, parts.yard);
  const listed = [];
  const lineMat = (col) => new THREE.LineBasicMaterial({ color: col, depthTest: false, transparent: true, opacity: 0.95 });
  // a box on the ground (its middle, its turn as three's rotation.y, its width along x and depth along z), every metre
  // of its edge laid on the land a little over it
  function box(into, col, x, z, rot, w, d) {
    const c = Math.cos(rot), s = Math.sin(rot), pts = [], at = (lx, lz) => [x + c * lx + s * lz, z - s * lx + c * lz];
    const corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], [-w / 2, -d / 2]];
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i], [bx, bz] = corners[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az)));
      for (let k = 0; k < n; k++) { const [px, pz] = at(ax + (bx - ax) * k / n, az + (bz - az) * k / n); pts.push(new THREE.Vector3(px, heightAt(px, pz) + 0.2, pz)); }
    }
    const L = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), lineMat(col)); L.renderOrder = 20; into.add(L);
  }
  function ring(into, col, x, z, r) {
    const pts = []; for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; pts.push(new THREE.Vector3(px, heightAt(px, pz) + 0.2, pz)); }
    const L = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), lineMat(col)); L.renderOrder = 20; into.add(L);
  }
  // a name over a spot: a little sign drawn on a canvas, always facing the view, about the same size on screen near and far
  function label(into, text, col, x, z, up = 4) {
    const cv = document.createElement('canvas'), g = cv.getContext('2d'), font = '600 30px Georgia, serif';
    g.font = font; const w = Math.ceil(g.measureText(text).width) + 24; cv.width = w; cv.height = 44;
    g.font = font; g.fillStyle = 'rgba(20,14,8,0.85)'; g.fillRect(0, 0, w, 44); g.strokeStyle = '#' + col.toString(16).padStart(6, '0'); g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, 41);
    g.fillStyle = '#f6e3b8'; g.textBaseline = 'middle'; g.fillText(text, 12, 23);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }));
    sp.scale.set(0.045 * w / 44, 0.045, 1); sp.position.set(x, heightAt(x, z) + up, z); sp.renderOrder = 21; into.add(sp);
    listed.push({ name: text, x: +x.toFixed(1), z: +z.toFixed(1) });
  }
  // ── the farm (src/farm.js: its place from the layout's game.farm, else the game's own spot) ──
  if (F && F.farmLayout) {
    const L = F.farmLayout(farm()), c = COL.farm;
    box(parts.fixed, c, L.x, L.z, L.rot, L.w, L.d);
    box(parts.fixed, c, L.barn.x, L.barn.z, L.barn.rot, L.barn.w, L.barn.d);
    for (const k of ['sheep', 'paddock', 'yard']) box(parts.fixed, c, L[k].x, L[k].z, L[k].rot, L[k].w, L[k].d);
    for (const p of L.pens) box(parts.fixed, c, p.x, p.z, p.rot, p.w, p.d);
    ring(parts.fixed, c, L.windmill.x, L.windmill.z, 1.6);
    label(parts.fixed, 'Farm (game)', c, L.x, L.z, 9); label(parts.fixed, 'barn', c, L.barn.x, L.barn.z, 9);
    label(parts.fixed, 'sheep', c, L.sheep.x, L.sheep.z, 3); label(parts.fixed, 'paddock', c, L.paddock.x, L.paddock.z, 3); label(parts.fixed, 'pig pens', c, L.yard.x, L.yard.z, 3);
    label(parts.fixed, 'farm windmill', c, L.windmill.x, L.windmill.z, 11);
  }
  // ── the windmill job's mill hill (world/objects/landforms.js HILL: the land itself is shaped there) ──
  if (LF && LF.HILL) { const h = LF.HILL; ring(parts.fixed, COL.mill, h.x, h.z, h.top); ring(parts.fixed, COL.mill, h.x, h.z, h.foot); label(parts.fixed, 'Mill hill: the windmill job', COL.mill, h.x, h.z, 14); }
  // ── the target range (src/range.js) ──
  if (R && R.RANGE) {
    const G = R.RANGE, c = Math.cos(G.rot), s = Math.sin(G.rot), mid = (G.fence.from + G.fence.to) / 2, x = G.x + s * mid, z = G.z + c * mid;
    box(parts.fixed, COL.range, x, z, G.rot, G.fence.at * 2, G.fence.to - G.fence.from);
    label(parts.fixed, 'Target range', COL.range, x, z, 5);
  }
  // ── the jobs board (src/jobsboard.js) ──
  if (JB && JB.BOARD) { const s = JB.BOARD.spot; box(parts.fixed, COL.board, s.x, s.z, 0, JB.BOARD.w, 0.6); label(parts.fixed, 'Jobs board', COL.board, s.x, s.z, 4.6); }
  // ── the homestead behind the player's cabin (src/homestead.js yardLayout), laid again when the cabin moves ──
  let yardAt = '';
  function yard() {
    const it = cabin(); if (!H || !H.yardLayout || !it) return;
    const key = [it.x, it.z, it.rot].join(); if (key === yardAt) return; yardAt = key;
    for (const o of [...parts.yard.children]) { parts.yard.remove(o); o.geometry.dispose(); if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    for (let i = listed.length - 1; i >= 0; i--) if (listed[i].yard) listed.splice(i, 1);
    const L = H.yardLayout({ x: it.x, z: it.z, rot: (it.rot || 0) * Math.PI / 180 }), n0 = listed.length;
    const names = { coop: 'your coop', pen: 'your pig pen', corral: 'your corral' };
    for (const [k, h] of Object.entries(L.homes)) { box(parts.yard, COL.homestead, h.x, h.z, h.rot, h.w, h.d); label(parts.yard, names[k] || k, COL.homestead, h.x, h.z, 3); }
    label(parts.yard, 'Homestead (behind your cabin)', COL.homestead, (L.homes.corral.x + L.homes.coop.x + L.homes.pen.x) / 3, (L.homes.corral.z + L.homes.coop.z + L.homes.pen.z) / 3, 7);
    for (let i = n0; i < listed.length; i++) listed[i].yard = true;
  }
  yard();
  const CP = { group, shown: true };
  CP.update = () => { if (CP.shown) yard(); };
  CP.show = (on) => { CP.shown = !!on; group.visible = CP.shown; if (on) yard(); };
  CP.list = () => listed.map(({ name, x, z }) => ({ name, x, z }));
  return CP;
}
