// THE LOADING STRIP: a band along the bottom of the screen while the station loads, saying what is loading and how
// far (megabytes come in out of about how many), gone when the station is ready. It sits over the title screen, so it
// shows whatever the title is showing, the new crew member's form too (the title's own small bar sits by the start
// button, which a first visit's form hides: the game's maker, 2026-11-15, "Is there a progress bar on the start
// menu? because I don't see one").
//
//   const bar = showLoadBar(document.body, { expect })   expect: about how many bytes a whole load is
//   bar.set(0.4, 'Building the rooms')    how far the work is, 0..1, and what it is doing
//   bar.done()                            full, then it fades away
//   bar.bytes()                           bytes that have come in so far
//   bar.expect(n)                         the bytes a whole load is, when it is known later
//
// The megabytes are counted from the files as each one arrives (the browser's list of finished downloads). The bar
// shows the further of the two (the work's step, or the bytes in out of the bytes expected, a download being most of a
// first visit's wait) and eases toward it, creeping on a little between steps so it never sits still for long. The
// moving is a CSS transition of the fill's transform, which the browser runs on its own: the bar keeps going while
// the game's code is busy for seconds at a time (the station's lights are worked out in one long go).
const CSS = `
.cst-loadstrip { position: fixed; left: 0; right: 0; bottom: 0; z-index: 4; pointer-events: none;
  padding: 10px max(16px, env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
  background: linear-gradient(to top, rgba(5, 7, 11, 0.94), rgba(5, 7, 11, 0.8)); box-shadow: 0 -1px 0 rgba(196, 220, 240, 0.18);
  color: #eef1f4; font: 600 13px/1.3 "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif;
  transition: opacity 0.7s ease, transform 0.7s ease; }
.cst-loadstrip.is-done { opacity: 0; transform: translateY(8px); }
.cst-loadstrip .ls-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 7px; }
.cst-loadstrip .ls-what { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: 0.03em; }
.cst-loadstrip .ls-what b { color: #ffb070; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; font-size: 12px; margin-right: 8px; }
@media (max-width: 480px) { .cst-loadstrip .ls-what b { display: none; } }
.cst-loadstrip .ls-much { flex: none; color: #a7b0ba; font-variant-numeric: tabular-nums; }
.cst-loadstrip .ls-bar { position: relative; height: 6px; border-radius: 3px; background: rgba(196, 220, 240, 0.16); overflow: hidden; }
.cst-loadstrip .ls-bar i { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; border-radius: 3px; transform-origin: 0 50%; transform: scaleX(0); will-change: transform;
  background: linear-gradient(90deg, #c46a1e, #ff8f2e 70%, #ffd2a6); box-shadow: 0 0 10px rgba(255, 143, 46, 0.7); }
`;

const MB = (b) => (b / 1e6).toFixed(b < 1e7 ? 1 : 0);

export function showLoadBar(parent = document.body, { expect = 0 } = {}) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'cst-loadstrip'; el.setAttribute('role', 'progressbar'); el.setAttribute('aria-valuemin', '0'); el.setAttribute('aria-valuemax', '100');
  el.innerHTML = '<div class="ls-row"><span class="ls-what"><b>Loading</b><span></span></span><span class="ls-much"></span></div><div class="ls-bar"><i></i></div>';
  parent.appendChild(el);
  const what = el.querySelector('.ls-what span'), much = el.querySelector('.ls-much'), fill = el.querySelector('.ls-bar i');

  // the bytes in: every finished download (and those finished before this strip was made)
  let got = 0;
  const seen = (e) => { got += e.transferSize || e.encodedBodySize || 0; };
  try { for (const e of performance.getEntriesByType('resource')) seen(e); } catch (e) { /* an old browser */ }
  let watch = null;
  try { watch = new PerformanceObserver((list) => { for (const e of list.getEntries()) seen(e); }); watch.observe({ type: 'resource' }); } catch (e) { /* no byte count: the steps still move it */ }

  const S = { f: 0, words: '', done: false };
  const target = () => {
    if (S.done) return 1;
    const want = expect > 0 ? Math.min(0.9, got / expect * 0.9) : 0;
    return Math.max(S.f, want);
  };
  // where the fill is heading: a little past the work's real figure (it slows as it nears that, so it never runs far
  // ahead of the work), restarted from where it is whenever the figure moves on
  let aim = -1;
  function steer() {
    const t = target(), cap = S.done ? 1 : Math.min(0.97, t + 0.06);
    if (Math.abs(cap - aim) < 0.004) return;
    aim = cap;
    fill.style.transition = S.done ? 'transform 0.5s ease-out' : 'transform 10s cubic-bezier(0.15, 0.8, 0.3, 1)';
    fill.style.transform = `scaleX(${cap.toFixed(4)})`;
  }
  // the words, and the percent as far as the fill has got
  function paint() {
    const m = /matrix\(([-\d.e]+)/.exec(getComputedStyle(fill).transform || '');
    const shown = S.done ? 1 : m ? Math.max(0, Math.min(1, +m[1])) : 0, pct = Math.floor(shown * 100);
    el.setAttribute('aria-valuenow', String(pct));
    what.textContent = S.done ? 'Station ready' : S.words;
    const total = Math.max(expect, got * 1.05);
    much.textContent = S.done ? `${MB(got)} MB` : expect > 0 ? `${MB(got)} of ${MB(total)} MB · ${pct}%` : `${MB(got)} MB · ${pct}%`;
  }
  let raf = 0;
  function step() { steer(); paint(); raf = S.done ? 0 : requestAnimationFrame(step); }
  step();

  return {
    set(f, words) { if (Number.isFinite(+f)) S.f = Math.max(S.f, Math.min(1, +f)); if (words != null) S.words = String(words); },
    done() {
      if (S.done) return; S.done = true; cancelAnimationFrame(raf); steer(); paint();
      if (watch) try { watch.disconnect(); } catch (e) { /* gone */ }
      setTimeout(() => { el.classList.add('is-done'); }, 900);
      setTimeout(() => { el.remove(); style.remove(); }, 1800);
    },
    bytes: () => got,
    expect(n) { if (+n > 0) expect = +n; },
  };
}
