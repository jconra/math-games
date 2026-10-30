// THE VALLEY'S DIALS (Mathwood Valley): the governor's scenery dials (world/governor.js DIALS) wired to the valley
// (world/valley.js). The governor turns them only at a curtain (the title, a menu open, the cabin, the mist at the ends:
// Dad's rule that nothing changes in view), so each change is made whole at once, nothing left to fill in after:
//   ratio      the renderer's pixel ratio (never past the screen's own)
//   shadows    the shadow map's size and how far round the camera it reaches, and whether the plants cast; 'off' leaves the
//              map empty and stops drawing it (the materials keep their shadow code: turning it off or on builds nothing).
//              A load with no shadow map (the potato band) can't turn them on: limited to 'off' until a reload
//   grass      the meadow plants' count, circle and mesh range: laid again round the camera at once
//   lawn       the lawn's circle and thickness: laid again round the camera at once (none: taken up)
//   stones     the share of the loaded stones drawn (the creeks' come first in each mesh): each mesh's count
//   trees      how far out trees are models (the forest's imposter distance and crossfade)
//   ground     the ground shader's switches (anti-repeat tiling, painted leaves and their reach, far detail, waves)
//   sky        the cloud dome          beams   the sunbeams pass          props   the town's decorative props
//   bindValley(G, { V, renderer }) -> off()
import * as THREE from 'three';

// the props that are only decoration (the lamps, lanterns, signposts, hitching posts, troughs and the dock stay: they
// light the town at night or are used)
export const DECOR_PROPS = new Set(['barrel', 'crate', 'garden', 'planter', 'flowerBed', 'bench', 'easel', 'picnicTable', 'stall']);

export function bindValley(G, { V, renderer }) {
  const offs = [];
  // ── RESOLUTION ──
  offs.push(G.on('ratio', (v) => {
    const r = Math.min(window.devicePixelRatio || 1, v);
    if (Math.abs(renderer.getPixelRatio() - r) < 1e-3) return;
    renderer.setPixelRatio(r);   // (three sizes the drawing buffer again; the sunbeams and depth of field follow it each frame)
    if (V.U && V.U.res) renderer.getDrawingBufferSize(V.U.res.value);
  }));
  // (a resolution step that changes nothing on this screen (1.5x and 2x on a 1x screen) is skipped by the governor)
  { const dpr = window.devicePixelRatio || 1, L = [0.5, 0.75, 1, 1.5, 2];
    let most = L.findIndex((x) => x >= dpr - 1e-3); if (most < 0) most = L.length - 1;
    if (most < L.length - 1) G.limit('ratio', most, `this screen has ${dpr}x its pixels`); }

  // ── SHADOWS ──
  // (renderer.shadowMap read each time: three makes a new one when the graphics context is restored)
  const SH = V.SHADOW, sun = V.sun;
  const canShadow = !!(SH && SH.on && renderer.shadowMap.enabled && sun.castShadow);
  if (!canShadow) G.limit('shadows', 0, 'no shadow map in this load (the potato band): a reload brings it', true);
  let plantsCast = null;
  function plantShadows(on) {
    const f = V.coverForest; if (!f || !f.built) return;
    if (plantsCast === on && f === plantShadows.f) return;
    plantShadows.f = f; plantsCast = on;
    for (const b of f.built) { if (b.imposter) b.imposter.castShadow = on; for (const m of b.meshes || []) m.castShadow = on; }
  }
  offs.push(G.on('shadows', (v) => {
    if (!canShadow) return;
    if (v.off) {
      SH.paused = true;
      // one last drawing of the map through a camera that sees nothing (a slab a millimetre thick up in the sky where the
      // light is), then it isn't drawn again: every receiver falls outside that view, and three counts that as lit. The
      // light keeps following the sun (world/valley.js followShadow, paused)
      const c = sun.shadow.camera; c.left = -1; c.right = 1; c.top = 1; c.bottom = -1; c.near = 1; c.far = 1.001; c.updateProjectionMatrix();
      renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
      V.U.shadowRange.value = 0;   // (the trees' and plants' eased shadow edge off: all lit, as with no shadows)
      plantShadows(false);
      return;
    }
    SH.paused = false; SH.range = v.range; renderer.shadowMap.autoUpdate = true;
    if (sun.shadow.mapSize.x !== v.size) {
      sun.shadow.mapSize.set(v.size, v.size);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }   // (made again at the new size when next drawn)
    }
    plantShadows(!!v.plants);
  }));

  // ── GRASS AND PLANTS ──
  const C = V.COVER;
  offs.push(G.on('grass', (v) => {
    if (!C) return;
    const same = C.count === v.count && C.radius === v.radius && C.near === v.near && C.farX === v.farX;
    if (same) return;
    C.count = v.count; C.radius = v.radius; C.farX = v.farX; C.near = v.near;
    const f = V.coverForest;
    if (f) { f.imposterAt = v.near; f.band = v.near * C.fade; f.assignDirty = true; }   // (the drawer kept: its mesh range read each frame)
    C.job = null; C.at.set(1e9, 0, 1e9);   // (laid again round the camera: world/valley.js followCover)
    // (the governor turns it only at a curtain (world/governor.js): laid again all at once now, behind it, so nothing is seen
    // filling in after; while loading, the valley lays them itself)
    if (f && f.ready) { let n = 0; do V.followCover(); while (C.job && ++n < 200000); }
  }));

  // ── LAWN ──
  const LW = V.LAWN, LG = V.LAWN_GO;
  offs.push(G.on('lawn', (v) => {
    if (!LW || (LW.radius === v.radius && LW.density === v.density)) return;
    LW.radius = v.radius; LW.density = v.density; LG.job = null;
    if (!(v.radius > 0)) { V.lawn.set([]); LW.count = 0; }
    else if (V.coverForest && V.coverForest.ready) V.placeLawn();   // (at a curtain: laid at once, round the camera)
    else LG.at.set(1e9, 0, 1e9);   // (while loading: laid as the valley goes on: lawnFrame)
  }));

  // ── STONES ── (each stone mesh's full count kept, the share drawn)
  const full = new WeakMap(); let share = 1, meshesOf = null;
  function stones() {
    const ms = (V.STONES && V.STONES.meshes) || []; meshesOf = ms;
    for (const m of ms) { if (!full.has(m)) full.set(m, m.count); m.count = Math.round(full.get(m) * share); m.visible = m.count > 0; }
  }
  offs.push(G.on('stones', (v) => { share = v; stones(); }));

  // ── TREES UP CLOSE ──
  let treesV = null;
  function trees() { const f = V.treeForest; if (!f || !treesV) return; if (f.imposterAt === treesV.at && f.band === treesV.band && f === trees.f) return; trees.f = f; f.imposterAt = treesV.at; f.band = treesV.band; f.assignDirty = true; }
  offs.push(G.on('trees', (v) => { treesV = v; trees(); }));

  // ── GROUND DETAIL ──
  offs.push(G.on('ground', (v) => { const U = V.U; for (const k of Object.keys(v)) if (U[k]) U[k].value = v[k]; }));
  // ── CLOUDS, SUNBEAMS ──
  offs.push(G.on('sky', (on) => { V.sky.uniforms.cloudOn.value = on ? 1 : 0; V.sky.mesh.visible = !!on; }));
  offs.push(G.on('beams', (on) => { V.BEAMS.on = !!on; if (on && V.beamsReady) V.beamsReady(); }));
  // ── DECORATIONS ──
  let propsOn = true;
  function props() {
    const vil = V.TOWN && V.TOWN.village; if (!vil) return;
    for (const o of vil.objs.values()) if (o.it && o.it.type === 'prop' && DECOR_PROPS.has(o.it.kind) && o.inner) o.inner.visible = propsOn;
  }
  offs.push(G.on('props', (on) => { propsOn = !!on; props(); if (V.CODE) V.CODE.setProps(on); }));
  // the code-built buildings' whole outsides and outdoor props: within this many metres of a doorway (objects/codebuildings.js)
  offs.push(G.on('outsides', (m) => { if (V.CODE) V.CODE.setRange(m); }));
  // ... and how much of their insides loads when the player comes to a door (1 needed .. 3 clutter: GOVERNOR.md Interiors)
  offs.push(G.on('insideDetail', (n) => { if (V.CODE) V.CODE.setDetail(n); }));
  // ... and whether a see-through window in view, the player in front of it, brings its room in (GOVERNOR.md Interiors)
  offs.push(G.on('windowArc', (v) => { if (V.CODE) V.CODE.setArc(v); }));

  // (now and then: what was made again since, the stones laid again, the plants' drawer rebuilt, new props, kept to the dials)
  const keepUp = setInterval(() => {
    if (V.STONES && V.STONES.meshes !== meshesOf) stones();
    trees();
    const sv = G.value('shadows'); if (canShadow && !sv.off && V.coverForest !== plantShadows.f) { plantsCast = null; plantShadows(!!sv.plants); }
    props();
  }, 1000);
  return () => { clearInterval(keepUp); for (const f of offs) f(); };
}
