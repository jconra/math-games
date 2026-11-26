// WHAT CAN BE USED, WITH THE MOUSE (the rules: src/usableplan.js, whose top says what the game's maker asked). One
// helper for the whole game: each thing that can be used hands it its shape, when it is in reach and what E does, and
// while it is in reach the cursor over it is a hand and a click on it does what E does. On a phone nothing changes.
//
//   const U = makeUsable({ canvas, camera, input })
//   U.add({ name, ready, shape, use }) -> remove()      (usableplan.js; the shapes below)
//   U.update()          once a frame, just before the picture is drawn (the camera where it is drawn from)
//   U.state()           for the rigs: { over, hand, cursor, ready, stats }
//   U.at(x, y)          for the rigs: the name of the thing in reach under a page point, or null
//
// THE SHAPES a thing hands over (tested only while it is in reach, and only when the mouse or the view has moved):
//   an Object3D         its meshes, exactly (a screen's face, the forklift), where they are drawn
//   { box: [x0, y0, z0, x1, y1, z1], matrix }   a box in a frame of its own (matrix: a Matrix4, or a function giving
//                       one: a ship's, as it is now), for a thing that is part of a room's one mesh (the kiosk, a seat)
//   { at(x, y) }        a test of its own -> how far off along the view, or null (a person: src/friendcard.js)
// A CLICK is the game's own (shared/input.js: pressed and let go without dragging, the left button, never a finger),
// on the view itself: a card, a button or a panel over the game takes its own clicks first, the click never reaching
// the view. Whatever uses a click marks it (pick.used), so nothing else takes the same click for itself.
import * as THREE from 'three';
import { makeUsableCore } from './usableplan.js';

export function makeUsable({ canvas, camera, input = null }) {
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), inv = new THREE.Matrix4(), local = new THREE.Ray(), box = new THREE.Box3(), _p = new THREE.Vector3();
  let rect = null, rectAt = -1;
  const rectNow = () => { const t = performance.now(); if (!rect || t - rectAt > 500) { rect = canvas.getBoundingClientRect(); rectAt = t; } return rect; };
  // (the ray under a page point, through the camera as it was last drawn)
  let rayFor = null;
  const rayAt = (x, y) => {
    if (rayFor && rayFor.x === x && rayFor.y === y && rayFor.n === n) return ray;
    const r = rectNow(); if (!r.width || !r.height) return null;
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    camera.updateMatrixWorld(); ray.setFromCamera(ndc, camera);
    rayFor = { x, y, n };
    return ray;
  };
  let n = 0;   // (a new ray each test: the camera may have moved)
  const shown = (o) => { for (let p = o; p; p = p.parent) { if (p.visible === false) return false; if (!p.parent) return p.isScene === true; } return false; };
  function hit(shape, x, y) {
    if (!shape) return null;
    if (typeof shape.at === 'function') return shape.at(x, y);
    const R = rayAt(x, y); if (!R) return null;
    if (shape.isObject3D) {
      if (!shown(shape)) return null;
      const h = R.intersectObject(shape, true).find((q) => shown(q.object));
      return h ? h.distance : null;
    }
    if (shape.box) {
      const M = typeof shape.matrix === 'function' ? shape.matrix() : shape.matrix;
      if (typeof shape.matrix === 'function' && !M) return null;
      const b = shape.box;
      box.min.set(b[0], b[1], b[2]); box.max.set(b[3], b[4], b[5]);
      if (M) { inv.copy(M).invert(); local.copy(R.ray).applyMatrix4(inv); } else local.copy(R.ray);
      if (!local.intersectBox(box, _p)) return null;
      if (M) _p.applyMatrix4(M);
      return _p.distanceTo(R.ray.origin);
    }
    return null;
  }
  const core = makeUsableCore({ hit, cursor: (on) => { canvas.style.cursor = on ? 'pointer' : ''; } });

  // the mouse over the view (a finger never: a phone keeps its buttons)
  canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') core.move(e.clientX, e.clientY); });
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') core.leave(); });
  addEventListener('resize', () => { rect = null; });
  // (nothing is used while a panel is up over the game (the input let go), the view is being dragged round, or the
  // pointer is locked to the flying)
  const blocked = () => (input && input.enabled === false) || !!document.pointerLockElement || !!(input && input.dragging);
  if (input && input.onPick) input.onPick((pk) => {
    if (pk.touch || pk.used) return;
    n++;
    const T = core.click(pk.x, pk.y, { touch: false, moved: 0, blocked: blocked() });
    if (T && T.use) pk.used = T.name;
  });

  // the view as it was last tested from: tested again only when it has moved (or the mouse has, or what is in reach)
  const last = new Float32Array(32);
  const viewMoved = () => {
    const a = camera.matrixWorld.elements, b = camera.projectionMatrix.elements; let moved = false;
    for (let i = 0; i < 16; i++) { if (last[i] !== a[i]) { moved = true; last[i] = a[i]; } if (last[16 + i] !== b[i]) { moved = true; last[16 + i] = b[i]; } }
    return moved;
  };
  return {
    add: (T) => core.add(T),
    update() { camera.updateMatrixWorld(); const v = viewMoved(); n++; core.frame(v, blocked()); },
    get over() { return core.over ? core.over.name : null; },
    at(x, y) { n++; const T = core.which(x, y); return T ? T.name : null; },
    state: () => ({ over: core.over ? core.over.name : null, hand: core.hand, cursor: canvas.style.cursor || '', ready: core.readyNames(), all: core.names(), stats: { ...core.stats, ms: +core.stats.ms.toFixed(3) } }),
    core,
  };
}
