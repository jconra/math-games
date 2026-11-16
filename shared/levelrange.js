// shared/levelrange.js: THE LEVEL RANGE, a two-handled slider over a ladder of levels: the easiest and the hardest
// level a place (a Mathwood job, a station job) may ask. The game's maker, 2026-11-16: "a range selector at the top that
// had a min and max value (kind of like a price filter on Amazon). So instead of having 30 check boxes to uncheck, a
// slider can easily be adjusted to get medium-range questions." Both games use this one file: Mathwood's levels page
// (mathwood-valley/src/ui/levels.js) and the space game's job levels (pi-nebula/src/ui/levels.js).
//
//   const R = makeLevelRange({ n, lo, hi, here, name(i), label, onInput(lo, hi), onChange(lo, hi) })
//   host.appendChild(R.el); R.set(lo, hi, here); R.focus('lo' | 'hi'); R.value() -> [lo, hi]
//     n         levels on the ladder; lo, hi: the ends, 0-based (lo <= hi; the same for one level)
//     here      the level the player is on (a thin mark on the track), or null
//     name(i)   level i's name ('Count by 2s'), shown as the handles move
//     onInput   while a handle moves (each level it passes); onChange once it is let go, or for each key press
//
// A finger or a mouse: drag either handle (they can meet, never cross: min = max is one level); a tap on the track
// moves the nearer handle there; on a phone a finger moving up or down the track scrolls the page as usual. Keys, on
// a handle (Tab to it): arrows a level at a time, Page Up / Page Down a tenth of the ladder, Home / End as far as it
// goes. Each handle is a slider for a screen reader ("Easiest level asked: level 5 of 41, Count by 2s").
//
// Its look comes from the page's colours: these custom properties on any parent (each game sets its own):
//   --lr-rail, --lr-fill, --lr-tick, --lr-thumb, --lr-thumb-edge, --lr-bubble, --lr-bubble-ink, --lr-focus, --lr-here,
//   --lr-ink, --lr-mute
// Everything is under .lr; the few rules every game needs (sizes, the finger room round a handle) are put on the page
// once, here.
//
// Pure parts, for node: valueAt(f, n), pairWith(lo, hi, which, v), keyMove(key, n, lo, hi, which), rangeWords(lo, hi,
// n, name).

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// the level at a fraction f (0..1) of the track
export function valueAt(f, n) { return n <= 1 ? 0 : clamp(Math.round(clamp(f, 0, 1) * (n - 1)), 0, n - 1); }
// a handle moved to v: the pair, the handles meeting but never crossing
export function pairWith(lo, hi, which, v) { return which === 'lo' ? [clamp(v, 0, hi), hi] : [lo, Math.max(lo, v)]; }
// a key on a handle -> its new value, or null (not a key the slider uses)
export function keyMove(key, n, lo, hi, which) {
  const v = which === 'lo' ? lo : hi, big = Math.max(1, Math.round(n / 10));
  const min = which === 'lo' ? 0 : lo, max = which === 'lo' ? hi : n - 1;
  const to = { ArrowLeft: v - 1, ArrowDown: v - 1, ArrowRight: v + 1, ArrowUp: v + 1, PageDown: v - big, PageUp: v + big, Home: min, End: max }[key];
  return to == null ? null : clamp(to, min, max);
}
// the range in words: 'Levels 5 to 12 of 41', 'Only level 5 of 41', 'All 41 levels'
export function rangeWords(lo, hi, n) {
  if (lo === 0 && hi === n - 1) return n === 1 ? 'The one level' : `All ${n} levels`;
  if (lo === hi) return `Only level ${lo + 1} of ${n}`;
  return `Levels ${lo + 1} to ${hi + 1} of ${n}`;
}

const CSS = `
.lr { position: relative; padding-top: 30px; color: var(--lr-ink, inherit); -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
.lr-track { position: relative; height: 44px; margin: 0 16px; cursor: pointer; touch-action: pan-y; }
.lr-rail, .lr-fill { position: absolute; top: 50%; height: 8px; margin-top: -4px; border-radius: 99px; }
.lr-rail { left: -8px; right: -8px; background: var(--lr-rail, rgba(255, 255, 255, 0.16)); box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.45); }
.lr-fill { background: var(--lr-fill, #e2ad4c); }
.lr-tick { position: absolute; top: 50%; width: 4px; height: 4px; margin: -2px 0 0 -2px; border-radius: 50%; background: var(--lr-tick, rgba(0, 0, 0, 0.5)); pointer-events: none; }
.lr-here { position: absolute; top: 50%; width: 3px; height: 26px; margin: -13px 0 0 -1.5px; border-radius: 2px; background: var(--lr-here, #fff); opacity: 0.85; pointer-events: none; }
.lr-thumb { position: absolute; top: 50%; z-index: 2; width: 30px; height: 30px; margin: -15px 0 0 -15px; border-radius: 50%; box-sizing: border-box;
  background: var(--lr-thumb, #f3c56b); border: 3px solid var(--lr-thumb-edge, rgba(0, 0, 0, 0.35)); box-shadow: 0 2px 7px rgba(0, 0, 0, 0.5);
  touch-action: none; cursor: grab; outline: none; transition: transform 0.12s ease-out; }
.lr-thumb::before { content: ''; position: absolute; inset: -10px; border-radius: 50%; }
.lr-thumb:focus-visible { box-shadow: 0 0 0 3px var(--lr-focus, #fff), 0 2px 7px rgba(0, 0, 0, 0.5); }
.lr-thumb.is-active { cursor: grabbing; transform: scale(1.14); z-index: 3; }
.lr-thumb.is-top { z-index: 3; }
.lr-bubble { position: absolute; bottom: calc(100% + 7px); left: 50%; transform: translateX(-50%); min-width: 26px; padding: 2px 7px; border-radius: 8px;
  font: 700 13px/1.35 inherit; font-variant-numeric: tabular-nums; text-align: center; white-space: nowrap; pointer-events: none;
  color: var(--lr-bubble-ink, #1a120c); background: var(--lr-bubble, #f3c56b); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4); }
.lr-bubble[hidden] { display: none; }
.lr-ends { display: flex; justify-content: space-between; margin: 2px 8px 0; font-size: 12px; color: var(--lr-mute, inherit); opacity: 0.85; }
.lr-said { margin: 8px 2px 0; font-size: 14px; line-height: 1.4; min-height: 2.8em; }
.lr-said b { font-weight: 700; }
@media (prefers-reduced-motion: reduce) { .lr-thumb { transition: none; } }
`;
function ensureCss() {
  if (typeof document === 'undefined' || document.querySelector('style[data-lr]')) return;
  const s = document.createElement('style'); s.dataset.lr = '1'; s.textContent = CSS; document.head.appendChild(s);
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function makeLevelRange({ n, lo = 0, hi = n - 1, here = null, name = (i) => `Level ${i + 1}`, label = 'Levels to ask',
  loLabel = 'Easiest level asked', hiLabel = 'Hardest level asked', onInput = () => {}, onChange = () => {} } = {}) {
  ensureCss();
  n = Math.max(1, Math.floor(n || 1));
  let L = clamp(lo, 0, n - 1), H = clamp(hi, L, n - 1), HERE = here;
  const el = document.createElement('div');
  el.className = 'lr'; el.setAttribute('role', 'group'); el.setAttribute('aria-label', label);
  const ticks = n <= 60 && n > 1 ? Array.from({ length: n }, (_, i) => `<i class="lr-tick" style="left:${(100 * i) / (n - 1)}%"></i>`).join('') : '';
  el.innerHTML = `<div class="lr-track"><span class="lr-rail"></span><span class="lr-fill"></span>${ticks}<i class="lr-here" hidden></i>
      <span class="lr-thumb is-lo" role="slider" tabindex="0" aria-label="${esc(loLabel)}" aria-valuemin="1" aria-valuemax="${n}" data-k="lo"><span class="lr-bubble"></span></span>
      <span class="lr-thumb is-hi" role="slider" tabindex="0" aria-label="${esc(hiLabel)}" aria-valuemin="1" aria-valuemax="${n}" data-k="hi"><span class="lr-bubble"></span></span></div>
    <div class="lr-ends" aria-hidden="true"><span>1</span><span>${n}</span></div>
    <p class="lr-said" aria-live="polite"></p>`;
  const track = el.querySelector('.lr-track'), fill = el.querySelector('.lr-fill'), hereEl = el.querySelector('.lr-here');
  const T = { lo: el.querySelector('.lr-thumb.is-lo'), hi: el.querySelector('.lr-thumb.is-hi') };
  const said = el.querySelector('.lr-said');
  const pct = (i) => (n <= 1 ? 50 : (100 * i) / (n - 1));

  function paint() {
    fill.style.left = `${pct(L)}%`; fill.style.width = `${pct(H) - pct(L)}%`;
    T.lo.style.left = `${pct(L)}%`; T.hi.style.left = `${pct(H)}%`;
    for (const [k, v] of [['lo', L], ['hi', H]]) {
      T[k].setAttribute('aria-valuenow', String(v + 1));
      T[k].setAttribute('aria-valuetext', `level ${v + 1} of ${n}, ${name(v)}`);
    }
    // (the handles close together: one bubble says both)
    const near = track.clientWidth ? ((pct(H) - pct(L)) / 100) * track.clientWidth < 34 : H - L < 2;
    T.lo.querySelector('.lr-bubble').textContent = L === H ? String(L + 1) : near ? `${L + 1}–${H + 1}` : String(L + 1);
    T.hi.querySelector('.lr-bubble').hidden = near || L === H;
    T.hi.querySelector('.lr-bubble').textContent = String(H + 1);
    // (both handles at the top end: the easiest one on top, so it can be dragged back down)
    T.lo.classList.toggle('is-top', L === H && L === n - 1);
    hereEl.hidden = HERE == null;
    if (HERE != null) { hereEl.style.left = `${pct(HERE)}%`; hereEl.title = `You are on level ${HERE + 1}`; }
    said.innerHTML = L === H ? `<b>${esc(rangeWords(L, H, n))}:</b> ${esc(name(L))}`
      : `<b>${esc(rangeWords(L, H, n))}:</b> ${esc(name(L))} <span>to</span> ${esc(name(H))}`;
  }

  // ---- a finger or a mouse ----
  let drag = null;   // { id, which ('lo' | 'hi' | null: the handles met, chosen by the way it moves), x0, y0, moving, start: [lo, hi] }
  const fracAt = (x) => { const r = track.getBoundingClientRect(); return r.width ? (x - r.left) / r.width : 0; };
  function moveTo(which, v) {
    const [a, b] = pairWith(L, H, which, v);
    if (a === L && b === H) return;
    L = a; H = b; paint();
    try { onInput(L, H); } catch (e) { console.error(e); }
  }
  function nearer(v) {
    if (L === H) return v < L ? 'lo' : v > H ? 'hi' : null;
    return Math.abs(v - L) <= Math.abs(v - H) ? (v > H ? 'hi' : 'lo') : 'hi';
  }
  track.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || drag) return;
    const thumb = e.target.closest('.lr-thumb');
    const v = valueAt(fracAt(e.clientX), n);
    let which = thumb ? thumb.dataset.k : nearer(v);
    if (thumb && L === H) which = null;   // (both handles on one level: the first move says which)
    drag = { id: e.pointerId, which, x0: e.clientX, y0: e.clientY, moving: !!thumb, start: [L, H], onThumb: !!thumb };
    if (thumb) { e.preventDefault(); thumb.focus({ preventScroll: true }); thumb.classList.add('is-active'); }
    try { track.setPointerCapture(e.pointerId); } catch (err) { /* an old browser */ }
  });
  track.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    // (on the track a finger has to move sideways a little first: up or down is the page scrolling)
    if (!drag.moving) { if (Math.abs(e.clientX - drag.x0) < 6) return; drag.moving = true; }
    const v = valueAt(fracAt(e.clientX), n);
    if (drag.which == null) { if (v === L) return; drag.which = v < L ? 'lo' : 'hi'; }
    T.lo.classList.toggle('is-active', drag.which === 'lo'); T.hi.classList.toggle('is-active', drag.which === 'hi');
    moveTo(drag.which, v);
  });
  function end(e, commit) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    T.lo.classList.remove('is-active'); T.hi.classList.remove('is-active');
    if (commit && !d.moving && !d.onThumb) {
      // (a tap on the track: the nearer handle comes to it)
      const v = valueAt(fracAt(e.clientX), n), w = d.which || nearer(v);
      if (w) { moveTo(w, v); T[w].focus({ preventScroll: true }); }
    }
    if (!commit && d.moving) { [L, H] = d.start; paint(); try { onInput(L, H); } catch (err) { console.error(err); } }
    if (L !== d.start[0] || H !== d.start[1]) { try { onChange(L, H); } catch (err) { console.error(err); } }
  }
  track.addEventListener('pointerup', (e) => end(e, true));
  track.addEventListener('pointercancel', (e) => end(e, false));

  // ---- keys, on a handle ----
  for (const which of ['lo', 'hi']) {
    T[which].addEventListener('keydown', (e) => {
      const v = keyMove(e.key, n, L, H, which);
      if (v == null) return;
      e.preventDefault(); e.stopPropagation();
      const was = [L, H];
      moveTo(which, v);
      if (L !== was[0] || H !== was[1]) { try { onChange(L, H); } catch (err) { console.error(err); } }
    });
  }

  paint();
  // (the track's width is known once it is on the page: the bubbles then sit right)
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(paint);
  return {
    el,
    set(lo2, hi2, here2 = HERE) { L = clamp(lo2, 0, n - 1); H = clamp(hi2, L, n - 1); HERE = here2; paint(); },
    value: () => [L, H],
    focus(which) { if (T[which]) T[which].focus({ preventScroll: true }); },
    busy: () => !!drag,
  };
}
