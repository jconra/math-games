// SHOW ME: a short demonstration of building with the free boards, played on the real build site by a ghost hand (a
// fingertip on a phone, a mouse pointer on a computer). Shared by the windmill's and the bridge's builders
// (labs/windmill/builder.js, labs/bridge/builder.js), so it plays the same in the game (src/buildsite.js) and on the
// two lab pages.
//
// It plays by itself the first time a builder is opened (per rider in the game, per browser on a lab page) and again
// from the "Show me" button in the builder's top bar. Four steps, one short caption each:
//   1. take a board from the lumber pile and drop its bottom ring on a spot: it clicks in
//   2. drag its top ring onto another board: it turns green
//   3. tap an arrow twice: the free end moves half a foot each time
//   4. tap the check mark: it is nailed
// The hand drives the builder's REAL controls: it sends the same pointer events a finger or a mouse would (to the
// lumber on the bench, the free end's ring, an arrow, the check mark), so what shows is exactly what the player will
// do. The builder plays it in a SANDBOX (its begin(): the boards built so far and the lumber put aside, a clean yard
// with one board to build against; its end(): everything put back as it was), so nothing is built, no lumber is spent,
// nothing is saved, and no question is asked or answered. One tap anywhere (or any key) skips it; that tap does
// nothing else.
//
//   const S = makeShowMe(opts)   opts:
//     root        the builder's page (its #app: the panel and the view; the button goes in its top bar's tools)
//     kind        'windmill' | 'bridge' (the lab page's own record of having seen it: localStorage bm-showme-<kind>)
//     seen        optional { get() -> true once it has played for this rider, set() } (the game: kept on the rider)
//     auto        play it by itself when it hasn't been seen (false: only from the button; ?noshow on a page: false;
//                 a browser driven by a test script: only with ?showme)
//     ready()     the builder is up, on show and idle (building, nothing in hand, no card): it may start
//     begin()     the sandbox in: -> plan { socket, free (points in the builder's frame, feet), arrow (index of the
//                 arrow to tap), taps } or null (it can't play now); end() puts everything back
//     screen(P)   a point in the builder's frame -> the page ({ x, y, behind })
//     held()      the board in hand, as the builder's handle says it (handles.free, arrows: page points), or null
//     click()     optional: a small sound as the ring clicks into its spot
//     speak(text) optional: a caption read out (the game: for a rider who can't read yet)
//   S.play()  start it now (the button);  S.stop() stop it at once, everything put back (a save, the builder put away)
//   S.playing; S.state() for rigs { playing, step, of, caption, seen };  S.dispose()

const STEPS = 4;
const PID = 7301;   // (the ghost hand's pointer id: never one a real finger or mouse uses)

export function makeShowMe(opts) {
  const { root } = opts;
  const params = new URLSearchParams(location.search);
  const touch = matchMedia('(pointer: coarse)').matches || /Mobi|Android/i.test(navigator.userAgent);
  const key = 'bm-showme-' + opts.kind;
  const seen = opts.seen || {
    get() { try { return localStorage.getItem(key) === '1'; } catch (e) { return false; } },
    set() { try { localStorage.setItem(key, '1'); } catch (e) { /* storage blocked: it plays again next visit */ } },
  };
  // (not by itself in a browser driven by a test script, unless ?showme: the older rigs' first tap would only skip it)
  const auto = opts.auto !== false && !params.has('noshow') && (!navigator.webdriver || params.has('showme'));
  ensureCss();
  const $ = (sel) => root.querySelector(sel);
  const view = () => $('#view');

  // ── the button, in the top bar's tools (before Undo) ──────────────────────────────────────────────────────────
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'btn showme-btn'; btn.id = 'show-me';
  btn.title = 'Watch how a board goes up';
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg><span>Show me</span>';
  const tools = $('.bar.top .tools');
  if (tools) tools.insertBefore(btn, tools.firstChild);
  btn.addEventListener('click', () => { if (!playing) play(); });

  // ── the hand, the caption ─────────────────────────────────────────────────────────────────────────────────────
  const layer = document.createElement('div'); layer.className = 'showme' + (touch ? ' is-touch' : ''); layer.hidden = true;
  layer.innerHTML = `<div class="sm-cap" role="status" aria-live="polite"><div class="sm-dots"></div><div class="sm-text"></div><div class="sm-skip">${touch ? 'Tap' : 'Click'} anywhere to skip</div></div>
    <div class="sm-ring"></div><div class="sm-hand">${touch ? FINGER : POINTER}</div>`;
  root.appendChild(layer);
  const cap = layer.querySelector('.sm-cap'), capText = layer.querySelector('.sm-text'), dots = layer.querySelector('.sm-dots');
  const hand = layer.querySelector('.sm-hand'), ring = layer.querySelector('.sm-ring');

  let playing = false, run = 0, step = 0, caption = '', disposed = false;
  let at = { x: 0, y: 0 }, down = null;   // (where the hand is, page pixels; the element it is pressing, or null)
  const tip = touch ? { x: 17, y: 3 } : { x: 3.9, y: 2.6 };   // (the fingertip / the arrow's point, in the hand's own picture)
  const place = () => { hand.style.transform = `translate(${at.x - tip.x}px, ${at.y - tip.y}px)`; };

  // pointer events as a finger or the mouse sends them: to the element pressed, then (as if captured) every move and
  // the lift to that same element, bubbling up to the view and the window as the builder's own listeners expect
  function fire(type, target, x = at.x, y = at.y) {
    const pressed = type === 'pointerdown' || (type === 'pointermove' && !!down);
    const ev = new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, screenX: x, screenY: y,
      pointerId: PID, pointerType: touch ? 'touch' : 'mouse', isPrimary: true, button: type === 'pointermove' ? -1 : 0, buttons: pressed ? 1 : 0,
      width: touch ? 18 : 1, height: touch ? 18 : 1, pressure: pressed ? 0.5 : 0 });
    target.dispatchEvent(ev);
  }
  const press = (el) => { down = el; fire('pointerdown', el); hand.classList.add('is-down'); pulse(at); };
  const lift = () => { const el = down; if (!el) return; fire('pointerup', el); down = null; hand.classList.remove('is-down'); };
  function pulse(p, big = false) {
    ring.style.transform = `translate(${p.x}px, ${p.y}px)`;
    ring.classList.remove('go', 'is-big'); void ring.offsetWidth; ring.classList.add('go'); if (big) ring.classList.add('is-big');
  }

  // ── time ──────────────────────────────────────────────────────────────────────────────────────────────────────
  class Stopped extends Error {}
  const live = (id) => { if (id !== run || !playing) throw new Stopped(); };
  const frameP = () => new Promise((res) => requestAnimationFrame(res));
  async function wait(ms, id) { const t0 = performance.now(); while (performance.now() - t0 < ms) { await frameP(); live(id); } }
  // the hand glides to a point (a function: worked out again every frame, so it follows the board as it moves),
  // sending a move each frame while it presses
  const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
  async function glide(to, ms, id) {
    const from = { ...at }, t0 = performance.now();
    for (;;) {
      await frameP(); live(id);
      const k = Math.min(1, (performance.now() - t0) / ms), e = ease(k), q = to();
      if (!q) throw new Stopped();
      at = { x: from.x + (q.x - from.x) * e, y: from.y + (q.y - from.y) * e }; place();
      if (down) fire('pointermove', down);
      if (k >= 1) return;
    }
  }
  const center = (el, fy = 0.5) => { if (!el || el.hidden) return null; const r = el.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height * fy } : null; };

  function say(n, text) {
    step = n; caption = text;
    // (the caption sits over the middle of the builder's view, clear of its panel)
    const r = view() && view().getBoundingClientRect();
    if (r && r.width) { cap.style.left = Math.round(r.left + r.width / 2) + 'px'; cap.style.maxWidth = Math.round(Math.min(560, r.width - 20)) + 'px'; }
    capText.textContent = text;
    dots.innerHTML = n ? Array.from({ length: STEPS }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('') : '';
    cap.classList.remove('is-new'); void cap.offsetWidth; cap.classList.add('is-new');
    if (opts.speak) { try { opts.speak(text); } catch (e) { /* the voice is a help, never in the way */ } }
  }

  // ── the demonstration ─────────────────────────────────────────────────────────────────────────────────────────
  async function show(id, plan) {
    const tap = touch ? 'Tap' : 'Click';
    const bench = $('#bench-board');
    // (the hand comes in from the middle of the view)
    const v = view().getBoundingClientRect();
    at = { x: v.left + v.width * 0.55, y: v.top + v.height * 0.62 }; place();
    layer.hidden = false; layer.classList.remove('is-out'); void layer.offsetWidth; layer.classList.add('is-in');
    await wait(700, id);   // (the camera eases round to the demonstration's view meanwhile)
    // 1. a board from the pile, its bottom ring dropped on a spot
    say(1, 'Take a board from the pile. Drop its bottom ring on a spot.');
    await glide(() => center(bench, 0.8), 900, id);
    await wait(250, id);
    press(bench);
    await wait(180, id);
    const sock = () => { const s = opts.screen(plan.socket); return s && !s.behind ? s : null; };
    await glide(sock, 1300, id);
    await wait(250, id);
    lift();
    pulse(at, true); if (opts.click) opts.click();
    await wait(1100, id);
    // 2. the top ring dragged onto another board: it turns green
    say(2, 'Drag the top ring onto a board. It turns green.');
    const freeRing = () => { const h = opts.held(); return h && h.handles && h.handles.free; };
    await glide(freeRing, 800, id);
    await wait(250, id);
    if (!freeRing()) throw new Stopped();
    press($('#g-b'));
    await wait(150, id);
    const freeTo = () => { const s = opts.screen(plan.free); return s && !s.behind ? s : null; };
    await glide(freeTo, 1400, id);
    await wait(550, id);
    lift();
    await wait(900, id);
    // 3. an arrow, tapped twice: half a foot each time
    say(3, `${tap} an arrow to nudge the end half a foot.`);
    const arrowAt = () => { const h = opts.held(); return h && h.arrows && h.arrows[plan.arrow]; };
    await glide(arrowAt, 800, id);
    const arrowEl = root.querySelectorAll('.gz.arrow')[plan.arrow];
    for (let k = 0; k < (plan.taps || 2); k++) {
      await wait(350, id);
      press(arrowEl); await wait(110, id); lift();
      await wait(450, id);
    }
    await wait(500, id);
    // 4. the check mark: nailed
    say(4, `${tap} the check mark to nail it.`);
    const nail = $('#nail');
    await glide(() => center(nail), 800, id);
    await wait(300, id);
    press(nail); await wait(110, id); lift(); nail.click();
    // (the hand steps back off the spot at once, so it isn't seen pressing whatever shows under the check mark next)
    const cr = cap.getBoundingClientRect(), off = { x: at.x - 40, y: Math.min(at.y - 90, cr.top - 50) };
    await glide(() => off, 450, id);
    await wait(950, id);
    say(0, 'Your turn!');
    await wait(1300, id);
  }

  // play it: the builder's sandbox in, the steps, everything put back
  async function play() {
    if (playing || disposed) return false;
    const plan = opts.begin();
    if (!plan) return false;
    playing = true; const id = ++run;
    seen.set();
    root.classList.add('is-showme'); btn.disabled = true;
    guard(true);
    try { await show(id, plan); } catch (e) { if (!(e instanceof Stopped)) console.error('show me', e); }
    if (id === run) finish();
    return true;
  }
  function finish() {
    if (!playing) return;
    playing = false; run++;
    if (down) lift();
    hand.classList.remove('is-down');
    try { opts.end(); } catch (e) { console.error('show me: putting things back', e); }
    root.classList.remove('is-showme'); btn.disabled = false;
    layer.classList.remove('is-in'); layer.classList.add('is-out');
    setTimeout(() => { if (!playing) layer.hidden = true; }, 350);
    guard(false);
    step = 0; caption = '';
  }

  // ── a real tap or key while it plays: skip (and that tap does nothing else) ───────────────────────────────────
  let swallowUntil = 0;
  const skip = (e) => {
    if (!e.isTrusted) return;
    if (e.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    swallowUntil = performance.now() + 700;
    finish();
  };
  const swallow = (e) => {
    if (!e.isTrusted || performance.now() > swallowUntil) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  };
  let guarded = false;
  function guard(on) {
    if (on && !guarded) { addEventListener('pointerdown', skip, true); addEventListener('keydown', skip, true); guarded = true; }
    if (!on && guarded) { removeEventListener('pointerdown', skip, true); removeEventListener('keydown', skip, true); guarded = false; }
  }
  for (const t of ['pointerup', 'click', 'mousedown', 'mouseup', 'touchend']) addEventListener(t, swallow, true);

  // ── the first time: by itself, once the builder is on show and idle a moment ──────────────────────────────────
  let calm = 0, timer = null;
  if (auto && !seen.get()) {
    timer = setInterval(() => {
      if (disposed || playing) return;
      if (seen.get()) { clearInterval(timer); timer = null; return; }
      calm = onShow() && opts.ready() ? calm + 1 : 0;
      if (calm >= 6) { clearInterval(timer); timer = null; play(); }   // (0.9 s on show and idle)
    }, 150);
  }
  // (the builder's page really showing: faded in over the game, the lab page's loading cover gone)
  function onShow() {
    const r = view() && view().getBoundingClientRect(); if (!r || !r.width) return false;
    const site = root.closest('.bsite'); if (site && site.style.opacity !== '1') return false;
    const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height * 0.6);
    return !!e && root.contains(e);
  }

  return {
    play, stop: finish,
    get playing() { return playing; },
    state: () => ({ playing, step, of: STEPS, caption, seen: seen.get() }),
    dispose() {
      if (disposed) return;
      finish(); disposed = true;
      if (timer) clearInterval(timer);
      for (const t of ['pointerup', 'click', 'mousedown', 'mouseup', 'touchend']) removeEventListener(t, swallow, true);
      layer.remove(); btn.remove();
    },
  };
}

// The game's record of it, per rider: rider.builds.shown = { windmill: true, bridge: true } (builds(): the rider's builds
// object, made if missing; save(): the rider saved). -> { get, set } for makeShowMe's seen
export function shownOnce(builds, kind, save) {
  const rec = () => { const b = builds(); return b.shown && typeof b.shown === 'object' ? b.shown : null; };
  return {
    get: () => { const r = rec(); return !!(r && r[kind]); },
    set() { const b = builds(); b.shown = { ...(rec() || {}), [kind]: true }; try { save(); } catch (e) { console.error('show me: saving the rider', e); } },
  };
}

// the ghost hand's pictures: the mouse's arrow (its point at 3.9, 2.6 as drawn) and a hand pointing up (its fingertip at 17, 3)
const POINTER = `<svg viewBox="0 0 26 34" width="34" height="44" aria-hidden="true"><path d="M3 2v25l6.2-5.8 4.2 9.6 4.4-1.9-4.2-9.4H22z" fill="#fff" stroke="#1d1712" stroke-width="2" stroke-linejoin="round"/></svg>`;
const HAND_SHAPES = `<rect x="10" y="1" width="10" height="34" rx="5"/><rect x="8" y="24" width="30" height="31" rx="10"/>
  <rect x="19" y="21" width="9" height="15" rx="4.5"/><rect x="27" y="23" width="9" height="14" rx="4.5"/>
  <rect x="2" y="31" width="11" height="18" rx="5.5" transform="rotate(-28 7 40)"/>`;
const FINGER = `<svg viewBox="-2 -2 44 62" width="44" height="62" aria-hidden="true"><g fill="#1d1712" stroke="#1d1712" stroke-width="4" stroke-linejoin="round">${HAND_SHAPES}</g><g fill="#fdf6ea">${HAND_SHAPES}</g>
  <path d="M19.5 37v6M27.5 38v5" stroke="#cdbfa8" stroke-width="1.6" stroke-linecap="round"/></svg>`;

function ensureCss() {
  if (document.getElementById('bm-showme-css')) return;
  const st = document.createElement('style'); st.id = 'bm-showme-css';
  st.textContent = `
.showme { position: fixed; inset: 0; pointer-events: none; z-index: 40; }
.showme[hidden] { display: none; }
.showme.is-in { animation: sm-in .3s ease-out both; } .showme.is-out { animation: sm-out .3s ease-in both; }
@keyframes sm-in { from { opacity: 0; } to { opacity: 1; } } @keyframes sm-out { from { opacity: 1; } to { opacity: 0; } }
.sm-hand { position: fixed; left: 0; top: 0; width: 0; height: 0; will-change: transform; }
.sm-hand svg { position: absolute; left: 0; top: 0; display: block; filter: drop-shadow(0 3px 4px rgba(0,0,0,.45)); transform-origin: 3.9px 2.6px; transition: transform .12s; }
.showme.is-touch .sm-hand svg { transform-origin: 17px 3px; }
.sm-hand.is-down svg { transform: scale(.86); }
.showme.is-touch .sm-hand { opacity: .93; }
.sm-ring { position: fixed; left: 0; top: 0; width: 0; height: 0; }
.sm-ring::after { content: ''; position: absolute; left: -16px; top: -16px; width: 32px; height: 32px; border-radius: 50%; border: 3px solid #ffd77a; opacity: 0; box-sizing: border-box; }
.sm-ring.go::after { animation: sm-ring .6s ease-out; } .sm-ring.go.is-big::after { animation: sm-ring-big .75s ease-out; border-color: #9be38a; }
@keyframes sm-ring { from { opacity: .95; transform: scale(.4); } to { opacity: 0; transform: scale(1.5); } }
@keyframes sm-ring-big { from { opacity: 1; transform: scale(.5); } to { opacity: 0; transform: scale(2.3); } }
.sm-cap { position: fixed; left: 50%; bottom: 84px; transform: translateX(-50%); width: max-content; max-width: min(560px, calc(100vw - 24px)); box-sizing: border-box;
  padding: 10px 18px 9px; border-radius: 14px; background: rgba(29, 23, 18, .9); color: #fdf6ea; text-align: center;
  font: 700 19px/1.3 Bitter, Georgia, serif; box-shadow: 0 6px 22px rgba(0,0,0,.4); }
.sm-cap.is-new { animation: sm-pop .35s ease-out; }
@keyframes sm-pop { from { transform: translateX(-50%) translateY(8px); opacity: .2; } to { transform: translateX(-50%); opacity: 1; } }
.sm-dots { display: flex; justify-content: center; gap: 6px; margin-bottom: 5px; } .sm-dots:empty { display: none; }
.sm-dots i { width: 8px; height: 8px; border-radius: 50%; background: rgba(253,246,234,.3); } .sm-dots i.on { background: #ffd77a; }
.sm-skip { margin-top: 4px; font: 600 12px/1.2 system-ui, sans-serif; opacity: .7; letter-spacing: .02em; }
.is-showme #hint, .is-showme #trim-bar, .is-showme #say, .is-showme #sel-bar { visibility: hidden; }
.showme-btn { display: inline-flex; align-items: center; gap: 4px; }
.showme-btn svg { width: 14px; height: 14px; fill: currentColor; flex: none; }
.showme-btn:disabled { opacity: .55; }
@media (max-width: 700px) {
  .sm-cap { font-size: 16px; padding: 8px 12px 7px; bottom: 96px; }
  .showme-btn { gap: 2px; } .showme-btn svg { width: 11px; height: 11px; }
}
`;
  document.head.appendChild(st);
}
