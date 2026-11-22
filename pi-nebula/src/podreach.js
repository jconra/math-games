// REACHING A STASIS POD'S LOCK (src/podlock.js): walk or fly up to a pod and look at it, and a prompt comes up over the
// menu ("Stasis pod 2: its lock", E); or tap the pod itself. Either opens its lock. A pod already opened offers nothing.
// For the labs for now (the Planet Lab, the Kit Lab); the game's walking on the ground will use the same rule.
//
//   const R = makePodReach({ camera, canvas, pods, onPick, reach, cone, parent })
//     pods()      -> [{ group (THREE.Object3D, the pod), name, open (true once opened: nothing offered), i }]
//     onPick(p)   the pod whose lock is to open (one of pods())
//     reach       metres from the eye to the pod's middle within which it is offered (default 4.5: his pod is 3.2 m long)
//     cone        radians off the middle of the view within which it counts as looked at (default 0.4)
//     parent      where the prompt goes (default document.body)
//     aim()       (optional) the screen's height, -1 to 1, of the middle of what can be seen: a menu over the bottom of the
//                 screen moves it up (the Planet Lab's: the share of the screen its menu takes); else the middle, 0
//   R.update()    each frame: which pod (if any) is offered now -> it, or null
//   R.busy(on)    while a lock is open nothing is offered or tapped
//   R.tapped()    true just after a tap opened a pod's lock (so the page doesn't also take that click for itself)
//   R.dispose()
//   (the rule itself, plain numbers for the tests: src/podreach-plan.js inReach, REACH)
import * as THREE from 'three';
import { REACH, inReach } from './podreach-plan.js';

export function makePodReach({ camera, canvas, pods, onPick, reach = REACH.reach, cone = REACH.cone, parent = document.body, aim = null }) {
  const el = document.createElement('button');
  el.type = 'button'; el.className = 'pod-reach'; el.hidden = true;
  el.innerHTML = '<span class="pod-reach-name"></span><span class="pod-reach-what">Its lock</span><kbd>E</kbd>';
  parent.appendChild(el);
  if (!document.querySelector('style[data-pod-reach]')) {
    const st = document.createElement('style'); st.dataset.podReach = '1';
    st.textContent = `.pod-reach { position: fixed; left: 50%; bottom: calc(var(--bar, 0px) + 18px); transform: translateX(-50%); z-index: 20;
      display: inline-flex; align-items: center; gap: 10px; padding: 12px 20px; border: 0; cursor: pointer; color: #eef1f4;
      font: 700 16px/1.1 "Segoe UI", system-ui, sans-serif; letter-spacing: 0.04em; background: rgba(15, 19, 25, 0.92);
      box-shadow: inset 0 0 0 1.5px rgba(196, 220, 240, 0.5); clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px); }
      .pod-reach[hidden] { display: none; }
      .pod-reach:hover { box-shadow: inset 0 0 0 2px rgba(232, 243, 252, 0.95); }
      .pod-reach-what { color: #ffa552; }
      .pod-reach kbd { font: 700 11px/1 inherit; padding: 3px 6px; border-radius: 3px; background: rgba(255, 255, 255, 0.12); color: #a7b0ba; }
      .pod-reach > span { white-space: nowrap; }
      @media (hover: none) and (pointer: coarse) { .pod-reach kbd { display: none; } .pod-reach { bottom: calc(var(--bar, 0px) + 150px); } }`;
    document.head.appendChild(st);
  }
  let now = null, busy = false, tappedAt = -1e9;
  const _e = new THREE.Vector3(), _f = new THREE.Vector3(), _c = new THREE.Vector3(), _box = new THREE.Box3();
  const middle = (p) => _box.setFromObject(p.group).getCenter(_c);
  function update() {
    let best = null, bestD = Infinity;
    if (!busy) {
      camera.getWorldPosition(_e);
      const y = typeof aim === 'function' ? Number(aim()) || 0 : 0;
      if (y) _f.set(0, Math.max(-0.95, Math.min(0.95, y)), 0.5).unproject(camera).sub(_e).normalize(); else camera.getWorldDirection(_f);
      for (const p of pods() || []) {
        if (!p || p.open || !p.group) continue;
        const m = middle(p);
        if (!inReach(_e.toArray(), _f.toArray(), m.toArray(), { reach, cone })) continue;
        const d = m.distanceTo(_e); if (d < bestD) { bestD = d; best = p; }
      }
    }
    if (best !== now) {
      now = best; el.hidden = !now;
      if (now) el.querySelector('.pod-reach-name').textContent = now.name;
    }
    return now;
  }
  const pick = (p) => { if (!p || busy || p.open) return; el.hidden = true; now = null; onPick(p); };
  el.addEventListener('click', (e) => { e.currentTarget.blur(); pick(now); });
  const onKey = (e) => { if (e.code === 'KeyE' && now && !busy && !['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) { e.preventDefault(); pick(now); } };
  addEventListener('keydown', onKey);
  // a tap on a pod (a touch, a pen or a click that didn't drag): the nearest pod under it
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null;
  const onDown = (e) => { down = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: 0 }; };
  const onMove = (e) => { if (down && e.pointerId === down.id) down.moved = Math.max(down.moved, Math.hypot(e.clientX - down.x, e.clientY - down.y)); };
  const onUp = (e) => {
    const d = down; down = null;
    if (!d || e.pointerId !== d.id || d.moved > REACH.tap || busy || document.pointerLockElement) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    let hit = null, hitD = Infinity;
    for (const p of pods() || []) {
      if (!p || !p.group) continue;
      const h = ray.intersectObject(p.group, true).filter((x) => x.object.visible && !/shadow/.test(x.object.name))[0];
      if (h && h.distance < hitD) { hitD = h.distance; hit = p; }
    }
    if (hit) { e.preventDefault(); tappedAt = performance.now(); pick(hit); }
  };
  canvas.addEventListener('pointerdown', onDown, true);
  canvas.addEventListener('pointermove', onMove, true);
  canvas.addEventListener('pointerup', onUp, true);
  return {
    el, update, get now() { return now; },
    tapped: () => performance.now() - tappedAt < 400,   // (a tap just opened a lock: the lab takes no pointer lock for it)
    busy(on) { busy = !!on; if (busy) { el.hidden = true; now = null; } },
    // (for the rigs: the pod a tap at these screen points would open)
    tapAt: (x, y) => { onDown({ clientX: x, clientY: y, pointerId: -7 }); onUp({ clientX: x, clientY: y, pointerId: -7, preventDefault() {} }); },
    dispose() { el.remove(); removeEventListener('keydown', onKey); canvas.removeEventListener('pointerdown', onDown, true); canvas.removeEventListener('pointermove', onMove, true); canvas.removeEventListener('pointerup', onUp, true); },
  };
}
