// THE CREW LAB'S MENUS (2026-11-11; the game's maker: "a small menu that lists out the different categories of controls
// ... and that menu can be dragged around, but never be dismissed, since it is the master menu. And it's just a bunch of
// small buttons. When one of those buttons is pressed, then it opens that menu, which should be roughly rectangular, and
// can be dragged around the screen by its top bar, and dismissed with an X in the top-right"; and "roughly rectangular I
// mean square, so not long bars").
//   THE MASTER MENU: a small floating panel of small buttons, one a category; dragged by its top bar anywhere on the
//     screen; it has no X (it never closes) and stays above the windows. A button is lit while its window is open, and
//     opens or closes it.
//   EACH CATEGORY'S WINDOW: dragged by its top bar, closed by the X at its top right (or Esc, the one in front); several
//     may be open; the one touched comes to the front. (2026-11-15; the game's maker: "For the sub-windows can you make
//     them large enough so I don't have to scroll, or make the windows resizable.") Both: a window OPENS BIG ENOUGH TO
//     SHOW EVERYTHING IN IT where the screen allows (the narrowest of WIDTHS that fits it all in the screen's height
//     under the title strip; its picture grid no longer scrolls on its own); where even the widest doesn't fit, its
//     inside scrolls up and down (never sideways). And it is RESIZED BY ITS BOTTOM-RIGHT CORNER (the grip there: a
//     mouse, a pen or a finger), its inside wrapping to the new width. A size he sets is kept for this browser tab.
//   Every window is kept on the screen as the browser is resized. Where each is, its size if he set one, and which are
//   open are kept for this browser tab only (sessionStorage), never with the saved work.
//
//   const M = makeMenus({ items: [{ id, label, title }], store, top: () => px under the title strip, onOpen(id, on) })
//   M.body(id)         the window's inside (an element; its contents are the caller's)
//   M.open(id, on)     open (true), close (false) or toggle (undefined); M.isOpen(id); M.front(id)
//   M.state()          { master: [x, y], open: [ids, back to front], at: { id: [x, y] } }
//   M.fit()            every window kept on screen (called on resize)
const WIDTHS = [400, 480, 560, 640], MIN_W = 260, MIN_H = 140, GAP = 8;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function makeMenus({ items, store = 'crewlab.windows.v1', top = () => 0, onOpen = () => {} }) {
  let kept = {};
  try { kept = JSON.parse(sessionStorage.getItem(store) || '{}') || {}; } catch (_) { kept = {}; }
  const wins = new Map(), order = [];        // (order: open windows, back to front)
  let z = 20;
  // ── the master menu ──
  const master = document.createElement('nav');
  master.className = 'cm'; master.id = 'master'; master.setAttribute('aria-label', 'Crew Lab menu');
  const mbar = document.createElement('div'); mbar.className = 'cm-bar'; mbar.title = 'Drag me anywhere';
  mbar.innerHTML = '<span class="cm-grip" aria-hidden="true">⠿</span><span>Menu</span>';
  const list = document.createElement('div'); list.className = 'cm-items';
  const btn = {};
  for (const it of items) {
    const b = document.createElement('button'); b.className = 'cm-b'; b.textContent = it.label; b.dataset.win = it.id;
    b.title = it.title || it.label; b.setAttribute('aria-pressed', 'false');
    b.onclick = () => open(it.id);
    list.append(b); btn[it.id] = b;
  }
  master.append(mbar, list); document.body.append(master);
  // ── a window ──
  function make(it) {
    const w = document.createElement('section'); w.className = 'cw'; w.id = 'win-' + it.id; w.hidden = true;
    w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', it.label);
    const bar = document.createElement('div'); bar.className = 'cw-bar';
    const t = document.createElement('span'); t.className = 'cw-title'; t.textContent = it.label;
    const x = document.createElement('button'); x.className = 'cw-x'; x.textContent = '×'; x.title = 'Close'; x.setAttribute('aria-label', 'Close ' + it.label);
    x.onclick = () => open(it.id, false);
    bar.append(t, x);
    const body = document.createElement('div'); body.className = 'cw-body';
    const grip = document.createElement('div'); grip.className = 'cw-grip'; grip.title = 'Drag to resize'; grip.setAttribute('aria-hidden', 'true');
    w.append(bar, body, grip); document.body.append(w);
    w.addEventListener('pointerdown', () => front(it.id), true);
    drag(bar, w, () => save(), (e) => e.target === x);
    const W = { el: w, body, it };
    resizer(grip, W);
    wins.set(it.id, W);
    return W;
  }
  // (dragged by its bar: pointer events, so a mouse, a pen or a finger)
  function drag(bar, el, done, skip) {
    let g = null;
    bar.addEventListener('pointerdown', (e) => {
      if (skip && skip(e)) return;
      if (e.button != null && e.button > 0) return;
      const r = el.getBoundingClientRect(); g = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
      bar.setPointerCapture(e.pointerId); e.preventDefault(); document.documentElement.classList.add('cw-dragging');
    });
    bar.addEventListener('pointermove', (e) => { if (!g || e.pointerId !== g.id) return; place(el, e.clientX - g.dx, e.clientY - g.dy); const sel = getSelection && getSelection(); if (sel && sel.rangeCount) sel.removeAllRanges(); });
    const end = (e) => { if (!g || e.pointerId !== g.id) return; g = null; document.documentElement.classList.remove('cw-dragging'); done(); };
    bar.addEventListener('pointerup', end); bar.addEventListener('pointercancel', end);
  }
  // (resized by its corner grip: pointer events, so a mouse, a pen or a finger; kept on the screen; the size kept)
  function resizer(grip, W) {
    let g = null;
    grip.addEventListener('pointerdown', (e) => {
      if (e.button != null && e.button > 0) return;
      const r = W.el.getBoundingClientRect(); g = { id: e.pointerId, x: e.clientX, y: e.clientY, w: r.width, h: r.height, l: r.left, t: r.top };
      grip.setPointerCapture(e.pointerId); e.preventDefault(); e.stopPropagation(); document.documentElement.classList.add('cw-dragging');
    });
    grip.addEventListener('pointermove', (e) => {
      if (!g || e.pointerId !== g.id) return;
      setSize(W, g.w + e.clientX - g.x, g.h + e.clientY - g.y, g.l, g.t);
    });
    const end = (e) => { if (!g || e.pointerId !== g.id) return; g = null; document.documentElement.classList.remove('cw-dragging'); W.sized = true; save(); };
    grip.addEventListener('pointerup', end); grip.addEventListener('pointercancel', end);
  }
  // (a size set: at least MIN_W x MIN_H, never past the screen's right or bottom edge from where it is)
  function setSize(W, w, h, l = W.el.getBoundingClientRect().left, t = W.el.getBoundingClientRect().top) {
    const ww = Math.round(clamp(w, Math.min(MIN_W, innerWidth - 2 * GAP), Math.max(MIN_W, innerWidth - l - 2))), hh = Math.round(clamp(h, MIN_H, Math.max(MIN_H, innerHeight - t - 2)));
    W.el.style.width = ww + 'px'; W.el.style.height = hh + 'px'; W.el.style.maxHeight = '';
  }
  // (an element put at x, y, kept wholly on the screen where it fits; its top bar always reachable)
  function place(el, x, y) {
    const w = el.offsetWidth, h = el.offsetHeight, W = innerWidth, H = innerHeight;
    el.style.left = Math.round(clamp(x, 0, Math.max(0, W - w))) + 'px';
    el.style.top = Math.round(clamp(y, 0, Math.max(0, Math.min(H - h, H - 40)))) + 'px';
  }
  const at = (el) => [parseFloat(el.style.left) || 0, parseFloat(el.style.top) || 0];
  // (a window's place is kept once it has one, open or not; one never opened this tab keeps the place it was kept at)
  function save() {
    const s = { master: at(master), open: order.slice(), at: { ...(kept.at || {}) }, size: { ...(kept.size || {}) } };
    for (const [id, W] of wins) if (W.placed && !W.el.hidden) s.at[id] = at(W.el);
    for (const [id, W] of wins) if (W.sized && !W.el.hidden) s.size[id] = [W.el.offsetWidth, W.el.offsetHeight];
    try { sessionStorage.setItem(store, JSON.stringify(s)); } catch (_) { /* not kept: nothing lost but the places */ }
    kept = s;
  }
  // (y: where its top is or will be; it opens no taller than the screen below that, nor, there, under the master menu)
  function size(W, y = at(W.el)[1]) {
    const room = Math.max(Math.min(280, innerHeight - top() - 2 * GAP), innerHeight - Math.max(y, top() + GAP) - GAP), most = innerWidth - 2 * GAP;
    // (a size he set: kept, within the screen)
    const k = kept.size && kept.size[W.it.id];
    if (k && !W.sized) W.sized = true;
    if (W.sized) {
      const w = k ? k[0] : W.el.offsetWidth, h = k ? k[1] : W.el.offsetHeight;
      W.el.style.width = Math.round(clamp(w, Math.min(MIN_W, most), most)) + 'px'; W.el.style.height = Math.round(clamp(h, MIN_H, innerHeight - 2 * GAP)) + 'px'; W.el.style.maxHeight = '';
      return;
    }
    // (as it opens: the narrowest width that shows everything in it without scrolling, as tall as that needs; the
    // widest that fits the screen and scrolling inside where none does)
    W.el.style.height = ''; W.el.style.maxHeight = room + 'px';
    const ws = WIDTHS.filter((w) => w <= most);
    if (!ws.length) ws.push(most);
    for (const w of ws) {
      W.el.style.width = w + 'px';
      if (W.body.scrollHeight <= W.body.clientHeight + 1) return;
    }
  }
  function front(id) {
    const W = wins.get(id); if (!W || W.el.hidden) return;
    const i = order.indexOf(id); if (i >= 0) order.splice(i, 1); order.push(id);
    W.el.style.zIndex = ++z;
  }
  function open(id, on) {
    const W = wins.get(id) || make(items.find((i) => i.id === id));
    const want = on == null ? W.el.hidden : !!on;
    if (want === !W.el.hidden) { if (want) front(id); return; }
    W.el.hidden = !want; btn[id].classList.toggle('on', want); btn[id].setAttribute('aria-pressed', String(want));
    if (want) {
      onOpen(id, true);
      // (a new window: on a wide screen down the left and down the right under the menu by turns, each a step lower
      // than the last on its side; on a phone under the menu, each a step lower. Sized for where its top will be)
      const k = !W.placed && kept.at && kept.at[id], n = order.length, w0 = Math.min(WIDTHS[0], innerWidth - 2 * GAP);
      const wide = innerWidth >= 2 * w0 + 3 * GAP + master.offsetWidth, mb = master.getBoundingClientRect().bottom + GAP;
      const y = W.placed ? at(W.el)[1] : k ? k[1] : !wide ? mb + n * 30 : n % 2 === 0 ? top() + GAP + (n >> 1) * 34 : mb + (n >> 1) * 34;
      size(W, y);
      if (!W.placed) {
        if (k) place(W.el, k[0], k[1]);
        else place(W.el, !wide || n % 2 === 0 ? GAP : innerWidth - W.el.offsetWidth - GAP, y);
        W.placed = true;
      }
      front(id);
    } else {
      const i = order.indexOf(id); if (i >= 0) order.splice(i, 1);
      onOpen(id, false);
    }
    save();
  }
  function fit() {
    place(master, ...at(master));
    for (const W of wins.values()) if (!W.el.hidden) { size(W); place(W.el, ...at(W.el)); }
    save();
  }
  // the master menu where it was (this tab), else at the top right, under the title strip on a narrow screen
  requestAnimationFrame(() => {
    if (kept.master) place(master, kept.master[0], kept.master[1]);
    else place(master, innerWidth - master.offsetWidth - GAP, innerWidth < 720 ? top() + GAP : GAP);
    for (const id of kept.open || []) if (wins.has(id) || items.some((i) => i.id === id)) open(id, true);
  });
  drag(mbar, master, save);
  addEventListener('resize', fit);
  // (Esc closes the window in front)
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !order.length) return;
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    open(order[order.length - 1], false);
  });
  return {
    master, open, front, fit,
    isOpen: (id) => !!(wins.get(id) && !wins.get(id).el.hidden),
    body: (id) => (wins.get(id) || make(items.find((i) => i.id === id))).body,
    ids: () => items.map((i) => i.id),
    state: () => ({ master: at(master), open: order.slice(), at: Object.fromEntries([...wins].filter(([, W]) => !W.el.hidden).map(([id, W]) => [id, at(W.el)])),
      size: Object.fromEntries([...wins].filter(([, W]) => !W.el.hidden).map(([id, W]) => [id, [W.el.offsetWidth, W.el.offsetHeight, !!W.sized]])),
      scrolls: Object.fromEntries([...wins].filter(([, W]) => !W.el.hidden).map(([id, W]) => [id, W.body.scrollHeight > W.body.clientHeight + 1])) }),
    // (a window sized to fit its contents again, as when it opened: the size he set forgotten)
    refit: (id) => { const W = wins.get(id); if (!W || W.el.hidden) return; W.sized = false; if (kept.size) delete kept.size[id]; size(W); place(W.el, ...at(W.el)); save(); },
  };
}
