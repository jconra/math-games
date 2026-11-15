// THE LINE-UP (2026-11-15; the game's maker: "It might be helpful to have a lineup of all the heads in the same outfit,
// or all the outfits with the same head, And same thing with the hair and head. Then I would know if an adjustment
// really should be applied to a body, head or hair"). One part held, another varied, the people side by side:
//   heads    every head on this outfit (the hair worn kept, or none: Hair on / off)
//   outfits  this head on every outfit
//   hairs    every hair on this head ("No hair" first)
//   hairHeads  this hair on every head
// The rest of the recipe (colours, hands, height, face) is the person's shown. Each person stands in the SAME place as
// the person shown, on a layer of their own (THREE layers 1 to 24), and the screen is cut into a grid of TILES, one a
// person: the same camera drawn once a tile, seeing the floor and that tile's person only. So every Camera view (Full,
// Front, Side, Back, the close ones that follow the head or the neck, Down the collar) applies to the whole row, and
// dragging or zooming moves every tile's view together. The close views follow each person's own head or neck.
// A row is up to 8 across (8 at 1280 wide; a tile at least 150 px), and as many rows as fit (a tile at least 250 px
// tall, at most 3); more than a page: the window's arrows. Built once (a person a tile, one at a time, the page's
// own first); kept in step with every change four times a second: a person whose outfit, head, hair, hands, height or
// head's place changed is put together again (only that one), a hair fit, buzz, colours or face worn at once. Clicking a
// tile (not a drag) makes that person the one shown: the windows' edits then apply to it, at the level they're set to,
// and show across the row as they're made.
//   const L = makeLineup({ lib, makeCrew, scene, renderer, sun, topPx, current, onPick, paintOf, anchorOf })
//   L.open(kind) / L.close(); L.kind; L.on; L.page(d); L.pages; L.slots (the page's: { id, name, recipe, crew, layer });
//   L.render(camera, follow) (the frame's drawing, in place of renderer.render); L.update(dt, paused); L.sync() (kept
//   in step now); L.ready() (every tile built and in step); L.pose(name, t) (the clip held, every tile)
import * as THREE from 'three';

export const KINDS = {
  heads: { vary: 'head', label: 'Every head on this outfit', title: 'Every head, on the outfit shown (the hair worn, or none)' },
  outfits: { vary: 'suit', label: 'This head on every outfit', title: 'The head shown, on every outfit' },
  hairs: { vary: 'hair', label: 'Every hair on this head', title: 'Every hair (and none), on the head shown' },
  hairHeads: { vary: 'head', label: 'This hair on every head', title: 'The hair shown, on every head' },
};
const MIN_W = 150, MIN_H = 250, MAX_COLS = 8, MAX_ROWS = 3, GAP = 2, SYNC_MS = 250;

export function makeLineup({ lib, makeCrew, scene, renderer, sun, topPx, current, onPick, paintOf, anchorOf }) {
  const L = { on: false, kind: 'heads', hairOn: true, pageNo: 0, slots: [], busy: false };
  const cam = new THREE.PerspectiveCamera();
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  let tags = null, lastSync = 0, seq = 0, sunShadow = true;

  // (the ids varied, in the grids' order: the hair's starts with none)
  const ids = () => {
    const v = KINDS[L.kind].vary, P = lib.list.parts[v === 'suit' ? 'suit' : v];
    return [...(v === 'hair' ? [{ id: null, name: 'No hair' }] : []), ...P.map((p) => ({ id: p.id, name: p.name }))];
  };
  // the grid: columns and rows for this screen, the page's size
  function grid(n) {
    const W = innerWidth, H = innerHeight - topPx();
    const cols0 = Math.max(2, Math.min(MAX_COLS, Math.floor(W / MIN_W))), rows0 = Math.max(1, Math.min(MAX_ROWS, Math.floor(H / MIN_H)));
    const per = cols0 * rows0;
    const k = n == null ? per : Math.min(per, n), cols = Math.min(cols0, k), rows = Math.max(1, Math.ceil(k / cols));
    return { cols, rows, per, tw: Math.floor(W / cols), th: Math.floor(H / rows) };
  }
  L.perPage = () => grid().per;
  Object.defineProperty(L, 'pages', { get: () => Math.max(1, Math.ceil(ids().length / L.perPage())) });
  // a tile's place on the screen (CSS pixels from the top left)
  function rect(i, n) {
    const g = grid(n), c = i % g.cols, r = Math.floor(i / g.cols);
    return [c * g.tw, topPx() + r * g.th, g.tw - GAP, g.th - GAP];
  }
  // what a tile's person is: the person shown with the varied part swapped in (no hair on Hair off, the head line-up)
  function recipeFor(id) {
    const R = JSON.parse(JSON.stringify(current() || {}));
    R[KINDS[L.kind].vary] = id;
    if (L.kind === 'heads' && !L.hairOn) R.hair = null;
    return R;
  }
  // (what needs the person put together again, and what is worn at once)
  const buildKey = (R) => JSON.stringify([R.suit, R.head, R.hair, R.hand === undefined ? '-' : R.hand, R.size || 1, R.expression || null, R.head && R.suit ? lib.headPlaceOf(R.head, R.suit) : null, lib.smoothHair, lib.collarFit]);
  const liveKey = (R) => JSON.stringify([lib.fitOf(R.hair, R.head), lib.buzzOf(R.hair), R.colours || {}, R.face || {}]);

  function tagsEl() {
    if (tags) return tags;
    tags = document.createElement('div'); tags.id = 'lineup-tags'; tags.setAttribute('aria-hidden', 'true');
    document.body.append(tags);
    return tags;
  }
  function drawTags() {
    const T = tagsEl(); T.hidden = !L.on; if (!L.on) return;
    const cur = current() || {}, v = KINDS[L.kind].vary;
    T.replaceChildren(...L.slots.map((s, i) => {
      const [x, y, w, h] = rect(i, L.slots.length), d = document.createElement('div');
      d.className = 'lu-tile' + ((cur[v] || null) === (s.id || null) ? ' on' : '') + (s.crew ? '' : ' wait');
      d.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
      const t = document.createElement('span'); t.textContent = s.name + (s.crew ? '' : ' (putting together…)'); d.append(t);
      return d;
    }));
  }
  // (a person made for a tile: on its own layer, every part)
  async function build(s) {
    const my = ++s.gen, R = s.want;
    const c = await makeCrew(lib, R);
    if (my !== s.gen || !L.slots.includes(s)) { c.dispose(); return; }
    // (the bones at rest, before any clip: the sweeps measure there)
    c.rest = []; c.root.traverse((o) => { if (o.isBone) c.rest.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]); });
    c.root.traverse((o) => o.layers.set(s.layer));
    for (const m of Object.values(c.meshes)) m.userData.paint = m.material;
    if (s.crew) s.crew.dispose();
    s.crew = c; s.failed = false; s.key = buildKey(R); s.live = liveKey(R);
    scene.add(c.root);
    paintOf(c);
    const st = L.clip; if (st) { c.play(st.name in c.person.actions ? st.name : 'Idle', { fade: 0, speed: st.speed }); if (st.hold != null) holdAt(c, st.name, st.hold); else c.update(0); }
    c.lookAt(null);
    drawTags();
  }
  // every tile's person in step with the person shown (see the top); one put together at a time, the first tile first
  L.sync = async function sync() {
    if (!L.on || L.busy) return;
    L.busy = true; lastSync = performance.now();
    const slots = L.slots;
    try {
      for (const s of slots) {
        // (the page or the line-up changed meanwhile: the next sync takes the new one)
        if (!L.on || L.slots !== slots) break;
        s.want = recipeFor(s.id);
        const k = buildKey(s.want);
        if (!s.crew || s.key !== k) {
          try { await build(s); } catch (e) { console.warn('Line-up: ' + s.name + ' could not be put together (' + e.message + ')'); s.key = k; s.failed = true; }
          continue;
        }
        const lk = liveKey(s.want);
        if (lk !== s.live) {
          const c = s.crew, R = s.want; s.live = lk;
          await c.setFit(lib.fitOf(R.hair, R.head));
          c.setBuzz(lib.buzzOf(R.hair));
          c.setColours({ job: null, uniform: null, skin: null, hair: null, eyes: null, ...(R.colours || {}) });
          if (c.faceSliders.length) c.setFace(R.face || {});
        }
      }
    } finally { L.busy = false; }
  };
  // the page's tiles made (the old ones' people let go)
  function lay() {
    const all = ids(), per = L.perPage();
    L.pageNo = Math.max(0, Math.min(L.pageNo, Math.ceil(all.length / per) - 1));
    for (const s of L.slots) if (s.crew) s.crew.dispose();
    L.slots = all.slice(L.pageNo * per, L.pageNo * per + per).map((it, i) => ({ id: it.id, name: it.name, layer: 1 + i, crew: null, key: null, live: null, gen: 0 }));
    drawTags(); L.sync();
  }
  L.open = (kind) => {
    if (kind && KINDS[kind]) L.kind = kind;
    // (the page with the person shown on it)
    const cur = current() || {}, v = KINDS[L.kind].vary, i = ids().findIndex((x) => (x.id || null) === (cur[v] || null));
    L.pageNo = i >= 0 ? Math.floor(i / L.perPage()) : 0;
    if (!L.on) { L.on = true; sunShadow = sun.castShadow; sun.castShadow = false; }
    lay();
  };
  L.close = () => {
    if (!L.on) return;
    L.on = false; sun.castShadow = sunShadow;
    for (const s of L.slots) if (s.crew) s.crew.dispose();
    L.slots = []; drawTags();
  };
  L.page = (d) => { const n = L.pages; L.pageNo = ((L.pageNo + d) % n + n) % n; lay(); };
  L.hair = (on) => { L.hairOn = !!on; L.sync(); };
  // (the tiles follow the screen's size: a new grid, the page with the person shown)
  let lastPer = 0;
  addEventListener('resize', () => { if (!L.on) return; if (L.perPage() !== lastPer) { lastPer = L.perPage(); L.open(); } else drawTags(); });
  L.ready = () => !L.on || (!L.busy && L.slots.every((s) => (s.failed ? s.key === buildKey(recipeFor(s.id)) : s.crew && s.key === buildKey(recipeFor(s.id)) && s.live === liveKey(recipeFor(s.id)))));

  // ── the clip: every tile plays what the person shown plays ──
  L.clip = null;
  L.play = (name, speed = 1) => { L.clip = { name, speed, hold: null }; for (const s of L.slots) if (s.crew) s.crew.play(name in s.crew.person.actions ? name : 'Idle', { speed }); };
  function holdAt(c, name, t) {
    const a = c.person.actions[name]; if (!a) return;
    c.person.mixer.stopAllAction(); c.person.cur = null;
    a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.setEffectiveWeight(1).setEffectiveTimeScale(1).play();
    for (const pm of a._propertyBindings) if (pm) pm.buffer.fill(NaN, pm.valueSize, pm.valueSize * 3);
    c.person.cur = a; c.person.curName = name; a.time = t; c.update(0);
  }
  L.pose = (name, t) => { L.clip = { name, speed: 1, hold: t }; for (const s of L.slots) if (s.crew) holdAt(s.crew, name, t); };
  L.update = (dt, paused) => {
    if (!L.on) return;
    if (!paused) for (const s of L.slots) if (s.crew) s.crew.update(dt);
    if (performance.now() - lastSync > SYNC_MS) L.sync();
  };

  // ── drawing: the camera once a tile, that tile's layer and the floor's ──
  L.render = (camera, follow) => {
    const H = innerHeight, n = L.slots.length;
    renderer.setScissorTest(false); renderer.setClearColor(0x05080c, 1); renderer.clear();
    renderer.setScissorTest(true);
    const me = follow && anchorOf(null, follow, _a);
    for (let i = 0; i < n; i++) {
      const s = L.slots[i], [x, y, w, h] = rect(i, n);
      renderer.setViewport(x, H - y - h, w, h); renderer.setScissor(x, H - y - h, w, h);
      cam.fov = camera.fov; cam.near = camera.near; cam.far = camera.far; cam.aspect = w / h; cam.updateProjectionMatrix();
      cam.position.copy(camera.position); cam.quaternion.copy(camera.quaternion);
      // (a close view follows this tile's own head or neck)
      if (me && s.crew) cam.position.add(anchorOf(s.crew, follow, _b).sub(me));
      cam.layers.set(0); cam.layers.enable(s.layer);
      renderer.render(scene, cam);
    }
    renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, H);
  };
  // which tile is under a point on the screen
  L.tileAt = (px, py) => {
    const n = L.slots.length;
    for (let i = 0; i < n; i++) { const [x, y, w, h] = rect(i, n); if (px >= x && px < x + w + GAP && py >= y && py < y + h + GAP) return i; }
    return -1;
  };
  // (a click, not a drag, on a tile: that person made the one shown)
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = L.on ? [e.clientX, e.clientY] : null; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || !L.on) return;
    const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]); down = null;
    if (moved > 6) return;
    const i = L.tileAt(e.clientX, e.clientY); if (i < 0) return;
    onPick(KINDS[L.kind].vary, L.slots[i].id);
  });
  L.drawTags = drawTags;
  return L;
}
