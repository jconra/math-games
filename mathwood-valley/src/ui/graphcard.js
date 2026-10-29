// THE GRAPH CARD: the Professor's questions at the saloon's chalkboard (src/graphteacher.js asks them, src/math/graphs.js
// makes them). A dark card (at the right of the screen; along the bottom on a phone) with a chalkboard grid on it, big
// enough to tap: every grid point at least about 32 px from the next on a 390 px phone. One question at a time, five a
// sitting (dots in the corner):
//   find   "Find (2, 3)": tap where x and y meet. Right: the point drawn with its name, a small cheer, the next one.
//          Wrong: where they tapped, as (a, b), and the right one lit, walked to from 0; tap the lit one. No cost.
//   read   a point drawn: "What point is this?", four answers (a key under each, 1 to 4, outside the button). Wrong: that
//          button greys, the line says where that one would be and the walk to this one plays; pick again. No cost.
// "Show me" (always there, no cost): the walk on the grid: an arrow along the x line from 0 to x, then up or down to y,
// the steps counted, the point lit, and the rule under it ("x first: left or right; then y: up or down."). Stuck a while:
// a nudge in words and the button glows. After the fifth: the Professor's well-done line on the card, and it goes by
// itself (no result screen). "Not now" or Esc puts it away.
//
//   const C = openGraphCard({ parent, title, next(i) -> question, record(q, right), onDone() -> line, onClose(done) })
//     next: the i-th question of the sitting (makeQuestion's form); record: called once a question with its first answer,
//     unless "Show me" came before it (a peek is never a miss and never a free right); onDone: the sitting finished (the
//     pay), returns the line to show; onClose(done): the card gone (done: the sitting finished)
//   C.tap(x, y)  taps grid point (x, y) (the rigs; a tap or click on the grid)    C.pick(i)  answer i (0-based; keys 1-4)
//   C.where(x, y) -> { x, y, px } point (x, y) on the page and the grid's step in px (rigs)
//   C.show()     "Show me"    C.close()    C.state() -> { index, of, kind, x, y, text, line, walk, lit, tapped, done }
// z-index 30: over the HUD, under the counters' panels (32) and the lock box (60), as the band's card.
import { GRAPH, RULE, pointText, walk, wrongFind, wrongRead, nudge } from '../math/graphs.js';

const CSS_HREF = new URL('./graphcard.css', import.meta.url).href;
const FONTS_HREF = new URL('./fonts/fonts.css', import.meta.url).href;
function ensureCss() {
  for (const [href, k] of [[FONTS_HREF, 'bmFonts'], [CSS_HREF, 'bmGraph']]) {
    if (document.querySelector(`link[data-${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}]`)) continue;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.dataset[k] = '1'; document.head.appendChild(l);
  }
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CHEERS = ['Right on the spot!', 'Spot on!', 'That\'s the one!', 'Bang on!', 'Just so!'];

// the board's drawing: U viewBox units a grid step; a first-quarter grid keeps room at its left and bottom for the numbers,
// a four-quarter one has its numbers along the axes through the middle
const U = 40;
function frame(lo, hi) {
  const four = lo < 0, p = four ? { l: 0.5, r: 0.5, t: 0.5, b: 0.5 } : { l: 0.9, r: 0.5, t: 0.5, b: 0.9 };
  const span = hi - lo;
  return { lo, hi, four, w: (span + p.l + p.r) * U, h: (span + p.t + p.b) * U, X: (x) => (x - lo + p.l) * U, Y: (y) => (hi - y + p.t) * U, p };
}
function gridSvg(F) {
  const { lo, hi, X, Y, four } = F, out = [];
  for (let v = lo; v <= hi; v++) {
    out.push(`<line class="bmg-gl" x1="${X(v)}" y1="${Y(hi)}" x2="${X(v)}" y2="${Y(lo)}"/>`, `<line class="bmg-gl" x1="${X(lo)}" y1="${Y(v)}" x2="${X(hi)}" y2="${Y(v)}"/>`);
  }
  // the axes with their arrowheads, and their names
  const ax = Y(0), ay = X(0), xe = X(hi) + 0.38 * U, yt = Y(hi) - 0.38 * U, a = 0.16 * U;
  out.push(`<line class="bmg-ax" x1="${X(lo) - (four ? 0.3 * U : 0)}" y1="${ax}" x2="${xe}" y2="${ax}"/>`, `<path class="bmg-ah" d="M${xe + a} ${ax}L${xe - a} ${ax - a}L${xe - a} ${ax + a}Z"/>`);
  out.push(`<line class="bmg-ax" x1="${ay}" y1="${Y(lo) + (four ? 0.3 * U : 0)}" x2="${ay}" y2="${yt}"/>`, `<path class="bmg-ah" d="M${ay} ${yt - a}L${ay - a} ${yt + a}L${ay + a} ${yt + a}Z"/>`);
  out.push(`<text class="bmg-an" x="${xe - 0.05 * U}" y="${ax - 0.3 * U}">x</text>`, `<text class="bmg-an" x="${ay + 0.3 * U}" y="${yt + 0.3 * U}">y</text>`);
  // the numbers: under the x line and left of the y line (0 once, at the corner, on a first-quarter grid)
  const n = (v) => (v < 0 ? '−' + -v : String(v));
  for (let v = lo; v <= hi; v++) {
    if (v === 0 && four) continue;
    out.push(`<text class="bmg-num" x="${X(v)}" y="${ax + 0.42 * U}" text-anchor="middle">${n(v)}</text>`);
    if (v !== 0) out.push(`<text class="bmg-num" x="${ay - 0.2 * U}" y="${Y(v) + 0.14 * U}" text-anchor="end">${n(v)}</text>`);
  }
  if (four) out.push(`<text class="bmg-num" x="${ay - 0.2 * U}" y="${ax + 0.42 * U}" text-anchor="end">0</text>`);
  return out.join('');
}

export function openGraphCard({ parent = document.body, title = 'Graph practice', next, record = () => {}, onDone = () => '', onClose = () => {} }) {
  ensureCss();
  const el = document.createElement('div'); el.className = 'bm-graph'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', title);
  el.innerHTML = `<div class="bmg-head"><span class="bmg-title">${esc(title)}</span><span class="bmg-dots" aria-hidden="true"></span></div>
    <p class="bmg-ask" aria-live="polite"></p>
    <div class="bmg-board"><svg xmlns="http://www.w3.org/2000/svg" role="img"></svg></div>
    <p class="bmg-rule"></p>
    <div class="bmg-answers"></div>
    <p class="bmg-line" aria-live="polite"></p>
    <div class="bmg-foot"><button type="button" class="bmg-show">Show me</button><button type="button" class="bmg-close">Not now</button></div>`;
  parent.appendChild(el);
  const $ = (s) => el.querySelector(s), svg = $('svg');
  let i = 0, q = null, F = null, tried = false, peeked = false, busy = false, closed = false, done = false, stuckT = 0, line = '', walked = false, lit = false, tapped = null, cheer = 0;
  const S = { grid: null, walk: null, marks: null, ghost: null };

  function draw() {
    q = next(i); F = frame(q.lo, q.hi); tried = false; peeked = false; walked = false; lit = false; tapped = null; stuckT = 0; line = '';
    $('.bmg-dots').innerHTML = Array.from({ length: GRAPH.n }, (_, k) => `<i class="${k < i ? 'is-done' : k === i ? 'is-now' : ''}"></i>`).join('');
    $('.bmg-ask').textContent = q.text;
    svg.setAttribute('viewBox', `0 0 ${F.w} ${F.h}`); svg.setAttribute('aria-label', q.kind === 'find' ? `A grid from ${q.lo} to ${q.hi}: tap ${q.answer}` : 'A grid with a point on it');
    svg.innerHTML = `<rect class="bmg-bg" x="0" y="0" width="${F.w}" height="${F.h}" rx="${0.25 * U}"/><g>${gridSvg(F)}</g><g class="bmg-walk"></g><g class="bmg-marks"></g><circle class="bmg-ghost" r="${0.2 * U}" cx="-99" cy="-99"/>`;
    S.walk = svg.querySelector('.bmg-walk'); S.marks = svg.querySelector('.bmg-marks'); S.ghost = svg.querySelector('.bmg-ghost');
    el.classList.toggle('is-find', q.kind === 'find'); el.classList.toggle('is-four', F.four);
    if (q.kind === 'read') S.marks.innerHTML = dot(q.x, q.y, 'bmg-pt');
    const A = $('.bmg-answers');
    A.innerHTML = q.kind === 'read' ? q.choices.map((c, k) => `<span class="bmg-a"><button type="button" data-k="${k}">${esc(c.label)}</button><kbd>${k + 1}</kbd></span>`).join('') : '';
    A.querySelectorAll('button').forEach((b) => { b.onclick = () => pick(+b.dataset.k); });
    $('.bmg-rule').innerHTML = ''; setLine('');
    $('.bmg-show').classList.remove('is-glow');
    el.classList.remove('is-next'); void el.offsetWidth; el.classList.add('is-next');
  }
  const dot = (x, y, cls, r = 0.2) => `<circle class="${cls}" cx="${F.X(x)}" cy="${F.Y(y)}" r="${r * U}"/>`;
  // a point's name beside it, kept inside the board (to its upper right, or the other side near an edge)
  function label(x, y, cls) {
    // (above it for a point at or over the x line, below it under the line, so a walk coming up or down to it never runs
    // through its name)
    const right = x < F.hi - 1, up = y >= 0 ? y < F.hi - 0.5 : y <= F.lo + 0.5;
    const tx = F.X(x) + (right ? 0.32 : -0.32) * U, ty = F.Y(y) + (up ? -0.32 : 0.62) * U;
    return `<text class="bmg-lab ${cls}" x="${tx}" y="${ty}" text-anchor="${right ? 'start' : 'end'}">${pointText(x, y)}</text>`;
  }
  function setLine(t) { line = t; $('.bmg-line').textContent = t; }

  // the walk: along the x line from 0 to x, then up or down to y, each step counted, the point lit at the end
  function playWalk(animate = true) {
    const st = walk(q.x, q.y), parts = [];
    const reduce = !animate || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
    let t = 0;
    for (const s of st) {
      if (!s.n) continue;
      const [x0, y0] = s.from, [x1, y1] = s.to, cls = s.axis === 'x' ? 'is-x' : 'is-y', d = 0.14 * s.n + 0.3;
      const X0 = F.X(x0), Y0 = F.Y(y0), X1 = F.X(x1), Y1 = F.Y(y1), ux = Math.sign(X1 - X0), uy = Math.sign(Y1 - Y0), a = 0.17 * U;
      const tipX = X1 - ux * 0.22 * U, tipY = Y1 - uy * 0.22 * U;
      parts.push(`<path class="bmg-w ${cls}" pathLength="1" d="M${X0} ${Y0}L${tipX} ${tipY}" style="animation-delay:${t}s;animation-duration:${d}s"/>`);
      parts.push(`<path class="bmg-wh ${cls}" d="M${tipX + ux * a} ${tipY + uy * a}L${tipX - ux * a + uy * a} ${tipY - uy * a + ux * a}L${tipX - ux * a - uy * a} ${tipY - uy * a - ux * a}Z" style="animation-delay:${t + d * 0.9}s"/>`);
      const sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0), left = q.x < 0 || q.x > F.hi - 0.5;
      for (let k = 1; k <= s.n; k++) {
        // (each step's count at its middle: above the x line; beside the up-and-down arrow, on its far side from the y line)
        const tx = s.axis === 'x' ? F.X(x0 + sx * (k - 0.5)) : F.X(x0) + (left ? -0.2 : 0.2) * U, ty = s.axis === 'x' ? F.Y(0) - 0.2 * U : F.Y(y0 + sy * (k - 0.5)) + 0.14 * U;
        parts.push(`<text class="bmg-step ${cls}" x="${tx}" y="${ty}" text-anchor="${s.axis === 'x' ? 'middle' : left ? 'end' : 'start'}" style="animation-delay:${t + (d * k) / (s.n + 0.5)}s">${k}</text>`);
      }
      t += d + 0.15;
    }
    parts.push(`<circle class="bmg-lit" cx="${F.X(q.x)}" cy="${F.Y(q.y)}" r="${0.24 * U}" style="animation-delay:${t}s"/>`);
    parts.push(label(q.x, q.y, 'is-lit').replace('<text ', `<text style="animation-delay:${t}s" `));
    S.walk.innerHTML = parts.join('');
    el.classList.toggle('is-still', reduce);
    $('.bmg-rule').innerHTML = `<b class="is-x">x first</b>: left or right; then <b class="is-y">y</b>: up or down. Here: ${esc(walkLine())}.`;
    walked = true; lit = true;
  }
  const walkLine = () => { const [a, b] = walk(q.x, q.y); return `${a.dir ? a.words : 'no steps across'}, then ${b.dir ? b.words : 'no steps up or down'}`; };

  function right() {
    busy = true;
    if (!tried && !peeked) record(q, true);
    tried = true;
    S.marks.insertAdjacentHTML('beforeend', `${dot(q.x, q.y, 'bmg-ok', 0.24)}<circle class="bmg-burst" cx="${F.X(q.x)}" cy="${F.Y(q.y)}" r="${0.3 * U}"/>${label(q.x, q.y, 'is-ok')}`);
    S.walk.querySelectorAll('.bmg-lit, .bmg-lab').forEach((n) => n.remove());
    setLine(CHEERS[cheer++ % CHEERS.length]);
    setTimeout(() => {
      busy = false; if (closed) return;
      i++;
      if (i >= GRAPH.n) { finish(); return; }
      draw();
    }, 1000);
  }
  function miss() { if (!tried && !peeked) record(q, false); tried = true; stuckT = -999; }

  // a tap on the grid: the nearest point to it
  function tap(x, y) {
    if (closed || busy || done || !q || q.kind !== 'find') return;
    if (x < q.lo || x > q.hi || y < q.lo || y > q.hi) return;
    if (x === q.x && y === q.y) { right(); return; }
    miss(); tapped = { x, y };
    S.marks.innerHTML = `${dot(x, y, 'bmg-tap', 0.22)}${label(x, y, 'is-tap')}`;
    setLine(wrongFind({ x, y }, q));
    playWalk();
  }
  function pick(k) {
    if (closed || busy || done || !q || q.kind !== 'read') return;
    const c = q.choices[k], b = $(`.bmg-answers button[data-k="${k}"]`); if (!c || (b && b.disabled)) return;
    if (c.good) { if (b) b.classList.add('is-right'); right(); return; }
    if (b) { b.disabled = true; b.classList.add('is-wrong'); }
    miss(); setLine(wrongRead(c, q)); playWalk();
  }
  function show() {
    if (closed || busy || done || !q) return;
    if (!tried) peeked = true;
    playWalk(); $('.bmg-show').classList.remove('is-glow');
  }
  function finish() {
    done = true;
    let said = '';
    try { said = onDone() || ''; } catch (e) { console.error(e); }
    $('.bmg-dots').innerHTML = Array.from({ length: GRAPH.n }, () => '<i class="is-done"></i>').join('');
    el.classList.add('is-done'); $('.bmg-ask').textContent = said || 'Well done!'; setLine(''); $('.bmg-answers').innerHTML = ''; $('.bmg-rule').innerHTML = '';
    setTimeout(() => { if (closed) return; closed = true; el.classList.add('is-gone'); detach(); setTimeout(() => el.remove(), 420); onClose(true); }, 2200);
  }
  // the board's taps: the grid point nearest where it was touched (within half a step)
  const toGrid = (e) => {
    const r = svg.getBoundingClientRect(); if (!r.width || !F) return null;
    const vx = ((e.clientX - r.left) / r.width) * F.w, vy = ((e.clientY - r.top) / r.height) * F.h;
    return { x: Math.round(vx / U - F.p.l + F.lo), y: Math.round(F.hi - (vy / U - F.p.t)) };
  };
  svg.addEventListener('pointerdown', (e) => { const g = toGrid(e); if (g) { e.preventDefault(); tap(g.x, g.y); } });
  svg.addEventListener('pointermove', (e) => {
    if (!S.ghost || !q || q.kind !== 'find' || e.pointerType === 'touch') return;
    const g = toGrid(e), on = g && g.x >= q.lo && g.x <= q.hi && g.y >= q.lo && g.y <= q.hi;
    S.ghost.setAttribute('cx', on ? F.X(g.x) : -99); S.ghost.setAttribute('cy', on ? F.Y(g.y) : -99);
  });
  svg.addEventListener('pointerleave', () => { if (S.ghost) { S.ghost.setAttribute('cx', -99); S.ghost.setAttribute('cy', -99); } });
  $('.bmg-show').onclick = show;
  const close = () => { if (closed) return; closed = true; detach(); el.remove(); onClose(false); };
  $('.bmg-close').onclick = close;
  // stuck a while: the nudge in words, and the Show me button glows
  const tick = setInterval(() => {
    if (closed || done || busy || !q) return;
    stuckT += 0.5;
    if (stuckT >= GRAPH.stuck && !walked) { stuckT = -999; setLine(nudge(q)); $('.bmg-show').classList.add('is-glow'); }
  }, 500);
  const key = (e) => {
    if (closed) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
    const n = /^Digit([1-4])$/.exec(e.code) || /^Numpad([1-4])$/.exec(e.code);
    if (n) { e.preventDefault(); e.stopImmediatePropagation(); pick(+n[1] - 1); }
  };
  addEventListener('keydown', key, true);
  function detach() { clearInterval(tick); removeEventListener('keydown', key, true); }
  draw();
  // (for rigs: where grid point (x, y) is on the page, and how far apart the grid's points are, in px)
  const where = (x, y) => { const r = svg.getBoundingClientRect(); return F ? { x: r.left + (F.X(x) / F.w) * r.width, y: r.top + (F.Y(y) / F.h) * r.height, px: (U / F.w) * r.width } : null; };
  return {
    el, tap, pick, show, close, where,
    get open() { return !closed; },
    state: () => ({ index: i, of: GRAPH.n, kind: q && q.kind, x: q && q.x, y: q && q.y, text: q && q.text, choices: q && q.choices ? q.choices.map((c) => c.label) : null,
      good: q && q.choices ? q.choices.findIndex((c) => c.good) : null, line, walk: walked, lit, tapped, done, rule: RULE }),
  };
}
