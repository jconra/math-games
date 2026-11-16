// CHAT BUBBLES over the station's people (what they say: hellos, a captain's offer, talk between two), and the
// captain's question to the player. The title screen's look: dark glass, off-white words, eight-sided; a captain's
// bubble edged in the captains' yellow.
//
//   const B = makeBubbles({ camera, walls })
//   B.say(P, words, { secs, kind })   a bubble over P's head (its words for `secs`, reading time unless given); a new
//                                     one replaces P's last. kind: 'hello' | 'talk' | 'captain'
//   B.update(dt, list)                each frame: every bubble over its speaker's head on the screen; hidden while the
//                                     speaker is out of sight (not drawn, behind something solid, too far off)
//   B.ask({ who, what, yes, no, onYes, onNo })   the question at the bottom of the screen (two buttons; E answers yes):
//                                     -> { close() }; B.asking: the one up, or null
//   B.clear(P), B.clearAll(), B.count()
const CSS = `
.pnb-layer { position: fixed; inset: 0; pointer-events: none; z-index: 12; overflow: hidden; }
.pnb { position: absolute; left: 0; top: 0; display: flex; flex-direction: column; align-items: center; opacity: 0; transition: opacity 0.22s ease; will-change: transform, opacity; }
.pnb.is-on { opacity: 1; }
.pnb-box { max-width: min(250px, 56vw); padding: 7px 12px 8px; text-align: center; color: #eef1f4; background: rgba(13, 17, 23, 0.88);
  font: 600 14px/1.3 "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif; box-shadow: inset 0 0 0 1.5px rgba(196, 220, 240, 0.4);
  clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px); }
.pnb-tail { width: 12px; height: 7px; background: rgba(196, 220, 240, 0.55); clip-path: polygon(0 0, 100% 0, 50% 100%); }
.pnb.is-captain .pnb-box { box-shadow: inset 0 0 0 2px rgba(255, 205, 60, 0.85); }
.pnb.is-captain .pnb-tail { background: rgba(255, 205, 60, 0.85); }
.pnb.is-hello .pnb-box { font-size: 15px; }
@media (max-width: 640px) { .pnb-box { font-size: 13px; max-width: 64vw; padding: 6px 10px 7px; } }
.pnc { position: fixed; left: 50%; bottom: max(26px, env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 16; display: flex; align-items: center; gap: 10px;
  padding: 8px 8px 8px 16px; max-width: calc(100vw - 24px); color: #eef1f4; background: rgba(15, 19, 25, 0.92); box-shadow: inset 0 0 0 1.5px rgba(255, 205, 60, 0.7);
  font: 400 15px/1.3 "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none;
  clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px); }
.pnc[hidden] { display: none; }
.pnc-w { display: flex; flex-direction: column; min-width: 0; }
.pnc-w b { font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; color: #ffd560; }
.pnc-w small { font-size: 13px; color: #a7b0ba; }
.pnc button { flex: none; height: 44px; padding: 0 16px; border: 0; cursor: pointer; font: 800 14px/1 inherit; font-family: inherit; letter-spacing: 0.07em; text-transform: uppercase;
  clip-path: polygon(9px 0, calc(100% - 9px) 0, 100% 9px, 100% calc(100% - 9px), calc(100% - 9px) 100%, 9px 100%, 0 calc(100% - 9px), 0 9px); }
.pnc .pnc-yes { color: #1c1205; background: #ffc83c; }
.pnc .pnc-no { color: #eef1f4; background: rgba(40, 47, 56, 0.92); box-shadow: inset 0 0 0 1.5px rgba(196, 220, 240, 0.36); }
.pnc kbd { font: 700 10px/1 inherit; font-family: inherit; padding: 3px 5px; margin-left: 8px; border-radius: 3px; background: rgba(0, 0, 0, 0.18); vertical-align: 2px; }
@media (max-width: 640px) { .pnc { flex-wrap: wrap; row-gap: 6px; padding-right: 8px; } .pnc-w { flex: 1 1 100%; } .pnc button { flex: 1 1 0; } .pnc kbd { display: none; } }
`;
const READ = (words) => Math.min(9, 1.6 + words.length * 0.055);    // (seconds a bubble stays: long enough to read it)
const FAR = { hello: 12, talk: 14, captain: 14 };                     // (metres from the camera past which none shows)

export function makeBubbles({ camera, walls = null, root = document.body }) {
  if (!document.getElementById('pnb-css')) { const st = document.createElement('style'); st.id = 'pnb-css'; st.textContent = CSS; document.head.appendChild(st); }
  const layer = document.createElement('div'); layer.className = 'pnb-layer'; root.appendChild(layer);
  const live = new Map();     // person -> bubble
  const v = { x: 0, y: 0, z: 0 }, hp = camera.position.clone();

  function say(P, words, { secs = null, kind = 'talk' } = {}) {
    let b = live.get(P);
    if (!b) {
      const el = document.createElement('div'); el.className = 'pnb'; el.innerHTML = '<div class="pnb-box"></div><div class="pnb-tail"></div>';
      layer.appendChild(el);
      b = { el, box: el.firstChild, P, t: 0, secs: 0, kind, on: false, x: -1e4, y: -1e4, w: 0, h: 0 };
      live.set(P, b);
    }
    b.box.textContent = words; b.words = words; b.t = 0; b.secs = secs ?? READ(words); b.kind = kind;
    b.el.className = 'pnb is-' + kind + (b.on ? ' is-on' : '');
    b.measured = false;
    return b;
  }
  function drop(b) { b.el.remove(); live.delete(b.P); }
  function clear(P) { const b = live.get(P); if (b) drop(b); }

  // (is the line from the camera to a point clear of anything solid? looked along it every 0.4 m, past the first 0.3 m
  // and short of the last 0.5 m (the speaker's own head and shoulders))
  function clearView(x, y, z) {
    if (!walls) return true;
    const c = camera.position, dx = x - c.x, dy = y - c.y, dz = z - c.z, L = Math.hypot(dx, dy, dz);
    for (let s = 0.3; s < L - 0.5; s += 0.4) { const k = s / L; if (walls.solidAt(c.x + dx * k, c.y + dy * k, c.z + dz * k)) return false; }
    return true;
  }
  let frame = 0;
  function update(dt) {
    frame++;
    const W = innerWidth, H = innerHeight, placed = [];
    camera.updateMatrixWorld();
    for (const b of [...live.values()]) {
      b.t += dt;
      if (b.t > b.secs) { if (b.on) { b.on = false; b.el.classList.remove('is-on'); } if (b.t > b.secs + 0.3) drop(b); continue; }
      const P = b.P, head = P.c && P.c.bones && P.c.bones.Head;
      // (over the head as it is now: standing or sitting)
      if (head && P.inScene) { head.getWorldPosition(hp); v.x = hp.x; v.y = hp.y + 0.42; v.z = hp.z; }
      else { v.x = P.pos.x; v.z = P.pos.z; v.y = (P.drawnY ?? P.pos.y) + 2.05; }
      const far = Math.hypot(v.x - camera.position.x, v.y - camera.position.y, v.z - camera.position.z);
      let seen = !!P.shown && far < (FAR[b.kind] || 12);
      if (seen && (frame + (P.order || 0)) % 6 === 0) b.view = clearView(v.x, v.y, v.z);
      if (b.view === false) seen = false;
      let sx = 0, sy = 0;
      if (seen) {
        // (the point on the screen; behind the camera: not shown)
        const e = camera.matrixWorldInverse.elements, p = camera.projectionMatrix.elements;
        const cx = e[0] * v.x + e[4] * v.y + e[8] * v.z + e[12], cy = e[1] * v.x + e[5] * v.y + e[9] * v.z + e[13], cz = e[2] * v.x + e[6] * v.y + e[10] * v.z + e[14];
        if (cz > -0.3) seen = false;
        else {
          const w = -cz, nx = (p[0] * cx + p[8] * cz) / w, ny = (p[5] * cy + p[9] * cz) / w;
          sx = (nx + 1) / 2 * W; sy = (1 - ny) / 2 * H;
          // (the speaker's head off the screen: no bubble (one pulled in from the edge would seem to be someone else's))
          if (sx < 0 || sx > W || sy < 20 || sy > H + 40) seen = false;
        }
      }
      if (seen !== b.on) { b.on = seen; b.el.classList.toggle('is-on', seen); }
      if (!seen) continue;
      if (!b.measured) { b.w = b.el.offsetWidth; b.h = b.el.offsetHeight; b.measured = true; }
      b.sx = sx; b.sy = sy; placed.push(b);
    }
    // (two bubbles never on top of each other: the one further back goes up out of the way)
    placed.sort((a, b) => b.sy - a.sy);
    for (let i = 0; i < placed.length; i++) {
      const a = placed[i]; let y = a.sy;
      for (let j = 0; j < i; j++) { const o = placed[j]; if (Math.abs(o.sx - a.sx) < (o.w + a.w) / 2 + 4 && y > o.y - o.h - 4 && y - a.h < o.y + 4) y = o.y - o.h - 4; }
      a.y = y;
      // (kept whole on the screen: a speaker at its edge has their bubble just inside it)
      const x = Math.max(6, Math.min(W - a.w - 6, a.sx - a.w / 2)), top = Math.max(6, y - a.h);
      a.el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(top)}px, 0)`;
    }
  }

  // ── the captain's question ───────────────────────────────────────────────────────────────────────────────────────
  const q = document.createElement('div'); q.className = 'pnc'; q.hidden = true;
  q.innerHTML = '<div class="pnc-w"><b></b><small></small></div><button type="button" class="pnc-yes"><span></span><kbd>E</kbd></button><button type="button" class="pnc-no"></button>';
  root.appendChild(q);
  const yesB = q.querySelector('.pnc-yes'), noB = q.querySelector('.pnc-no');
  let asking = null;
  function answer(yes) { const A = asking; if (!A) return; close(); (yes ? A.onYes : A.onNo)?.(); }
  yesB.addEventListener('click', () => answer(true));
  noB.addEventListener('click', () => answer(false));
  addEventListener('keydown', (e) => { if (asking && !q.hidden && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); answer(true); } });
  function close() { asking = null; q.hidden = true; api.asking = null; }
  function ask({ who, what, yes = 'Interested', no = 'Not now', onYes, onNo }) {
    q.querySelector('b').textContent = who; q.querySelector('small').textContent = what;
    yesB.querySelector('span').textContent = yes; noB.textContent = no;
    asking = { onYes, onNo }; q.hidden = false;
    const h = { close() { if (asking && api.asking === h) close(); } };
    api.asking = h;
    return h;
  }
  // (shown only while walking: never over the title screen, where the station's life goes on behind it)
  let showing = true;
  const show = (on) => { if (on === showing) return; showing = on; layer.style.visibility = on ? '' : 'hidden'; };
  const api = { say, update, clear, show, clearAll() { for (const b of [...live.values()]) drop(b); }, count: () => live.size, live, ask, asking: null, hideAsk(on) { if (asking) q.hidden = !!on; } };
  return api;
}
