// counthelp.js: the helper for the early topics (Counting, Adding, Taking away), shown when a kid is stuck or after a
// wrong pick. Two pictures, one above the other, either of which can be left out:
//   ten-frames   two rows of five boxes holding counters. Counting: the dots, numbered one by one as they are counted.
//                Adding: the first number's counters, then the second's in gold, filling the frame up to ten before they
//                spill into the next (which is how "8 + 5 is 10 and 3 more" looks). Taking away: the counters, with the
//                ones taken away crossed out. A missing number: dashed rings where the unknown counters go.
//   number line  a stretch of the line with a hop for each step: one hop of one at a time while counting on or back
//                (numbered 1, 2, 3 so the kid counts the hops, not the marks), or hops of ten and to the next ten for
//                bigger numbers. The start is a hollow dot; the landing is a gold pill with the answer.
// The answer stays hidden until it is shown: a "?" where the hop lands (and no numbers past the start), or for a missing
// number, "how many hops?" over the hops (their numbers hidden: counting them is the answer).
//
//   const h = showCountHelp(container, picture)   // -> { el, remove(), done }
//   picture (from the topic's picture(), src/math/counting.js and the others):
//     frame   { kind: 'count', n } | { kind: 'add' | 'part' | 'take' | 'takePart', a, b }
//     line    { lo, hi, start, end, hops: [{ from, to, label }], ask: 'end' | 'hops', stops: [numbers to name],
//               known: the last number the card gives (counting by 5s: 5, 10, 15, ? knows up to 15) }
//     reveal  show the answer (after a pick) or keep it hidden (stuck, or "Show me" before a pick)
//     picked  the kid's wrong pick: a violet cross on the line, "your pick"
//     reason  one plain line under the picture
//   layoutCountHelp(picture, { width, compact }) works the drawing out without touching the page (the tests use it).

const MINUS = '−';
const numText = (n) => (n < 0 ? MINUS : '') + Math.abs(n);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f1 = (v) => Math.round(v * 10) / 10;

const SIZES = {
  full: { cell: 34, side: 22, tick: 15, key: 18, hopFont: 14, pill: 18, arcMin: 14, arcMax: 44, labelGap: 26 },
  compact: { cell: 22, side: 16, tick: 13, key: 15, hopFont: 12, pill: 15, arcMin: 10, arcMax: 30, labelGap: 18 },
};

// ---- the drawing, worked out ------------------------------------------------------------------------------------

export function layoutCountHelp(o = {}, { width = 620, compact = false } = {}) {
  const S = compact ? SIZES.compact : SIZES.full;
  const W = Math.max(260, Math.round(width));
  const reveal = o.reveal !== false;
  const out = { W, H: 0, reveal, frames: null, line: null, endAt: 0 };
  let y = 6, t = 0;

  // ten-frames
  const F = o.frame;
  if (F && F.kind) {
    const a = Math.max(0, Math.round(F.kind === 'count' ? F.n : F.a) || 0), b = Math.max(0, Math.round(F.b) || 0);
    const total = F.kind === 'add' || F.kind === 'part' ? a + b : a;
    const nFrames = Math.min(2, Math.max(1, Math.ceil(total / 10)));
    const gap = 18;
    const c = Math.max(14, Math.min(S.cell, (W - 2 * S.side - (nFrames - 1) * gap) / (nFrames * 5)));
    const fw = 5 * c, x0 = (W - (nFrames * fw + (nFrames - 1) * gap)) / 2;
    const frames = [];
    for (let k = 0; k < nFrames; k++) frames.push({ x: x0 + k * (fw + gap), y, w: fw, h: 2 * c });
    const dots = [];
    const per = compact ? 55 : 70;
    for (let i = 0; i < Math.min(20, total); i++) {
      const f = frames[Math.floor(i / 10)], j = i % 10;
      const cx = f.x + (j % 5 + 0.5) * c, cy = f.y + (Math.floor(j / 5) + 0.5) * c;
      // which kind of counter: the first number's, the one added (gold), an unknown (a dashed ring), or one taken away
      let cls = '', cross = false;
      if (F.kind === 'add' && i >= a) cls = 'more';
      if (F.kind === 'part' && i >= a) cls = reveal ? 'more' : 'empty';
      if (F.kind === 'take' && i >= a - b) { cls = 'gone'; cross = true; }
      if (F.kind === 'takePart' && i >= a - b) { cls = reveal ? 'gone' : 'empty'; cross = reveal; }
      dots.push({ cx, cy, r: c * 0.36, cls, cross, at: i * per, n: i + 1 });
    }
    t = dots.length * per + 120;
    // the crosses come after the counters, one at a time; the count numbers come in at a counting pace
    let k = 0;
    for (const d of dots) if (d.cross) d.crossAt = t + (k++) * 140;
    if (k) t += k * 140 + 100;
    const counted = F.kind === 'count' && reveal;
    if (counted) { dots.forEach((d, i) => { d.countAt = t + i * 230; }); t += dots.length * 230; }
    out.frames = { list: frames, cell: c, dots, counted, font: Math.round(c * 0.5) };
    y += 2 * c + 12;
  }

  // the number line
  const L = o.line;
  if (L && Number.isFinite(L.lo) && Number.isFinite(L.hi) && L.hi > L.lo) {
    const hops = (L.hops || []).filter((h) => Number.isFinite(h.from) && Number.isFinite(h.to) && h.from !== h.to);
    const ask = L.ask === 'hops' ? 'hops' : 'end';
    const badgeY = y + S.hopFont;
    if (ask === 'hops') y += S.hopFont + 8;   // (room for "how many hops?" over the hops)
    const side = S.side, u = (W - 2 * side) / (L.hi - L.lo);
    const X = (v) => side + (v - L.lo) * u;
    const longest = hops.reduce((m, h) => Math.max(m, Math.abs(X(h.to) - X(h.from))), 0);
    const arcH = (dx) => Math.max(S.arcMin, Math.min(S.arcMax, 8 + 0.32 * dx));
    const top = y + arcH(longest) + S.hopFont + 10;
    const base = top;
    const dir = Math.sign(L.end - L.start) || 1;
    // which numbers are hidden: past the start (the answer and beyond) while the answer is hidden; for a missing
    // number, the ones between the start and the end
    const known = Number.isFinite(L.known) ? L.known : L.start;   // the last number the card itself gives (counting by 5s: the third)
    const hidden = (v) => {
      if (reveal) return false;
      if (ask === 'end') return dir > 0 ? v > known : v < known;
      return (v - L.start) * dir > 0 && (v - L.end) * dir < 0;
    };
    // ticks every one when there's room, else every 5; numbers every 1, 5 or 10, whichever fits
    const tickStep = u >= 5 ? 1 : 5, labStep = u >= S.labelGap ? 1 : 5 * u >= S.labelGap + 8 ? 5 : 10;
    const ticks = [], labels = [];
    for (let v = Math.ceil(L.lo / tickStep) * tickStep; v <= L.hi; v += tickStep) ticks.push({ v, x: X(v), major: v % 10 === 0 || (tickStep === 1 && labStep > 1 && v % 5 === 0) });
    const keys = new Set([L.start, ...(L.stops || [])]);
    if (reveal || ask === 'hops') keys.add(L.end);
    for (const k of [...keys]) if (k < L.lo || k > L.hi || (hidden(k) && k !== L.end)) keys.delete(k);
    for (let v = Math.ceil(L.lo / labStep) * labStep; v <= L.hi; v += labStep) {
      if (keys.has(v) || hidden(v)) continue;
      if ([...keys].some((k) => Math.abs(X(k) - X(v)) < S.labelGap)) continue;
      if (!reveal && ask === 'end' && v === L.end) continue;
      labels.push({ v, x: X(v), key: false });
    }
    for (const k of keys) if (!(ask === 'end' && k === L.end)) labels.push({ v: k, x: X(k), key: true });
    // the hops, one after another
    const unit = hops.every((h) => Math.abs(h.to - h.from) === 1);
    const each = unit ? (compact ? 190 : 230) : 420;
    let at = t + 150;
    const arcs = hops.map((h) => {
      const x0 = X(h.from), x1 = X(h.to), dx = Math.abs(x1 - x0), hh = arcH(dx), xm = (x0 + x1) / 2;
      // the arrowhead's direction: the curve's slope where it lands
      const tx = x1 - xm, ty = 2 * hh, len = Math.hypot(tx, ty) || 1;
      const a = { from: h.from, to: h.to, x0, x1, xm, peak: base - hh, d: `M ${f1(x0)} ${base} Q ${f1(xm)} ${f1(base - 2 * hh)} ${f1(x1)} ${base}`,
        head: { x: x1, y: base, ux: tx / len, uy: ty / len }, label: h.label, showLabel: reveal || ask === 'end', at, ms: unit ? each - 30 : each - 60 };
      at += each;
      return a;
    });
    const landAt = at + 60;
    const picked = Number.isFinite(o.picked) && o.picked !== L.end && o.picked >= L.lo && o.picked <= L.hi ? { v: o.picked, x: X(o.picked) } : null;
    // the badge over the hops for a missing number: "how many hops?" or "5 hops"
    const span = Math.abs(L.end - L.start);
    const badge = ask === 'hops' ? { x: (X(L.start) + X(L.end)) / 2, y: badgeY, text: reveal ? (unit ? `${span} hop${span === 1 ? '' : 's'}` : `${dir > 0 ? '+' : MINUS}${span} in all`) : 'how many hops?', at: reveal ? landAt : 0 } : null;
    out.line = {
      lo: L.lo, hi: L.hi, x0: side - 6, x1: W - side + 6, base, u, ticks, labels, arcs, unit, ask, badge, picked,
      start: { v: L.start, x: X(L.start) }, end: { v: L.end, x: X(L.end), at: landAt, text: ask === 'end' && !reveal ? '?' : numText(L.end), guess: !reveal && ask === 'end' },
      labelY: base + S.tick + 9, pickY: base + S.tick + 30,
    };
    y = base + S.tick + (picked ? 40 : 18);
    t = landAt + 280;
  }
  out.H = Math.ceil(y + 4);
  out.endAt = t;
  out.S = S;
  return out;
}

// ---- the drawing, as SVG ------------------------------------------------------------------------------------------

function svgFor(L) {
  const S = L.S, parts = [];
  const delay = (ms) => (ms > 0 ? ` style="animation-delay:${Math.round(ms)}ms"` : '');
  if (L.frames) {
    const { list, cell: c, dots, counted, font } = L.frames;
    for (const f of list) {
      parts.push(`<rect class="ch-frame" x="${f1(f.x)}" y="${f1(f.y)}" width="${f1(f.w)}" height="${f1(f.h)}" rx="5"/>`);
      for (let k = 1; k < 5; k++) parts.push(`<line class="ch-cell" x1="${f1(f.x + k * c)}" y1="${f1(f.y)}" x2="${f1(f.x + k * c)}" y2="${f1(f.y + f.h)}"/>`);
      parts.push(`<line class="ch-cell" x1="${f1(f.x)}" y1="${f1(f.y + c)}" x2="${f1(f.x + f.w)}" y2="${f1(f.y + c)}"/>`);
    }
    for (const d of dots) {
      parts.push(`<circle class="ch-dot ch-in ${d.cls}" cx="${f1(d.cx)}" cy="${f1(d.cy)}" r="${f1(d.r)}"${delay(d.at)}/>`);
      if (d.cross) {
        const k = d.r * 0.85;
        parts.push(`<path class="ch-cross ch-fade" d="M ${f1(d.cx - k)} ${f1(d.cy - k)} L ${f1(d.cx + k)} ${f1(d.cy + k)} M ${f1(d.cx + k)} ${f1(d.cy - k)} L ${f1(d.cx - k)} ${f1(d.cy + k)}"${delay(d.crossAt)}/>`);
      }
      if (counted) parts.push(`<text class="ch-count ch-fade" x="${f1(d.cx)}" y="${f1(d.cy + font * 0.36)}" font-size="${font}" text-anchor="middle"${delay(d.countAt)}>${d.n}</text>`);
    }
  }
  const N = L.line;
  if (N) {
    const b = N.base;
    parts.push(`<line class="ch-track" x1="${f1(N.x0)}" y1="${b}" x2="${f1(N.x1)}" y2="${b}" stroke-width="3.5"/>`);
    parts.push(`<path class="ch-end" d="M ${f1(N.x1 + 9)} ${b} L ${f1(N.x1 - 1)} ${b - 6} L ${f1(N.x1 - 1)} ${b + 6} Z"/>`);
    if (N.lo > 0) parts.push(`<path class="ch-end" d="M ${f1(N.x0 - 9)} ${b} L ${f1(N.x0 + 1)} ${b - 6} L ${f1(N.x0 + 1)} ${b + 6} Z"/>`);
    for (const k of N.ticks) { const h = k.major ? 9 : 6; parts.push(`<line class="ch-tick${k.major ? ' major' : ''}" x1="${f1(k.x)}" y1="${b - h}" x2="${f1(k.x)}" y2="${b + h}"/>`); }
    for (const l of N.labels) parts.push(`<text class="ch-num${l.key ? ' key' : ''}" x="${f1(l.x)}" y="${f1(N.labelY)}" font-size="${l.key ? S.key : S.tick}" text-anchor="middle">${esc(numText(l.v))}</text>`);
    if (N.picked) {
      const p = N.picked, k = 7;
      parts.push(`<path class="ch-pick" d="M ${f1(p.x - k)} ${b - k} L ${f1(p.x + k)} ${b + k} M ${f1(p.x + k)} ${b - k} L ${f1(p.x - k)} ${b + k}"/>`);
      parts.push(`<text class="ch-pickcap" x="${f1(p.x)}" y="${f1(N.pickY)}" font-size="${S.hopFont}" text-anchor="middle">${esc(numText(p.v))}: your pick</text>`);
    }
    for (const a of N.arcs) {
      parts.push(`<path class="ch-arc ch-draw" pathLength="1" d="${a.d}" style="animation-delay:${a.at}ms;animation-duration:${a.ms}ms"/>`);
      const h = a.head, s = 8, w = 5, bx = h.x - h.ux * s, by = h.y - h.uy * s;
      parts.push(`<path class="ch-head ch-fade" d="M ${f1(h.x)} ${f1(h.y)} L ${f1(bx - h.uy * w)} ${f1(by + h.ux * w)} L ${f1(bx + h.uy * w)} ${f1(by - h.ux * w)} Z"${delay(a.at + a.ms - 40)}/>`);
      if (a.showLabel && a.label) parts.push(`<text class="ch-hoplab ch-fade" x="${f1(a.xm)}" y="${f1(a.peak - 6)}" font-size="${S.hopFont}" text-anchor="middle"${delay(a.at + a.ms / 2)}>${esc(a.label)}</text>`);
    }
    parts.push(`<circle class="ch-start" cx="${f1(N.start.x)}" cy="${b}" r="7"/>`);
    if (N.ask === 'end') {
      const e = N.end, tw = Math.max(26, String(e.text).length * S.pill * 0.62 + 14), th = S.pill + 10;
      parts.push(`<g class="ch-land ch-in"${delay(e.at)}><circle cx="${f1(e.x)}" cy="${b}" r="8"/></g>`);
      parts.push(`<g class="ch-pill ch-in${e.guess ? ' guess' : ''}"${delay(e.at + 80)}><rect x="${f1(e.x - tw / 2)}" y="${f1(N.labelY - th + 6)}" width="${f1(tw)}" height="${th}" rx="${th / 2}"/>`
        + `<text x="${f1(e.x)}" y="${f1(N.labelY)}" font-size="${S.pill}" text-anchor="middle">${esc(e.text)}</text></g>`);
    } else {
      parts.push(`<g class="ch-land ch-in"${delay(N.end.at)}><circle cx="${f1(N.end.x)}" cy="${b}" r="7"/></g>`);
    }
    if (N.badge) parts.push(`<text class="ch-badge ch-fade" x="${f1(N.badge.x)}" y="${f1(N.badge.y)}" font-size="${S.hopFont + 1}" text-anchor="middle"${delay(N.badge.at)}>${esc(N.badge.text)}</text>`);
  }
  return `<svg class="bm-ch-svg" viewBox="0 0 ${L.W} ${L.H}" width="${L.W}" height="${L.H}" aria-hidden="true">${parts.join('')}</svg>`;
}

// ---- on the page --------------------------------------------------------------------------------------------------

let cssAsked = false;
export function ensureCountHelpCss() {
  if (cssAsked || typeof document === 'undefined') return;
  cssAsked = true;
  const href = new URL('./counthelp.css', import.meta.url).href;
  if ([...document.querySelectorAll('link[rel="stylesheet"]')].some((l) => l.href === href)) return;
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href;
  document.head.appendChild(link);
}

// The words a screen reader says for the picture.
function describe(o) {
  const out = [];
  const F = o.frame, L = o.line, reveal = o.reveal !== false;
  if (F && F.kind === 'count') out.push(`Ten-frame with ${reveal ? F.n : 'some'} dots.`);
  else if (F && F.kind === 'add') out.push(`Ten-frames: ${F.a} counters and ${F.b} more.`);
  else if (F && F.kind === 'take') out.push(`Ten-frames: ${F.a} counters, ${F.b} crossed out.`);
  else if (F) out.push(`Ten-frames: ${F.a} counters.`);
  if (L) out.push(`Number line: from ${numText(L.start)}, ${(L.hops || []).length} hop${(L.hops || []).length === 1 ? '' : 's'}${reveal ? ` to ${numText(L.end)}` : ''}.`);
  return out.join(' ');
}

export function showCountHelp(container, o = {}) {
  ensureCountHelpCss();
  // the compact one on a short window (a phone on its side) or a narrow one (a phone held upright)
  const compact = o.size === 'compact' || (!o.size && typeof innerHeight === 'number' && innerHeight > 0 && (innerHeight < 500 || innerWidth < 560));
  const el = document.createElement('figure');
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.className = `bm-ch bm-ch--backing${compact ? ' bm-ch--compact' : ''}${o.animate === false || still ? ' bm-ch--still' : ''}`;
  el.setAttribute('role', 'img');
  container.appendChild(el);
  const cw = Number(o.width) || Math.min(660, (container.clientWidth || 640)) - 32;
  const L = layoutCountHelp(o, { width: cw, compact });
  el.setAttribute('aria-label', `${describe(o)}${o.reason ? ' ' + o.reason : ''}`);
  el.innerHTML = svgFor(L) + (o.reason ? `<figcaption class="bm-ch-reason ch-fade">${esc(o.reason)}</figcaption>` : '');
  const svg = el.querySelector('svg');
  svg.style.maxWidth = `${L.W}px`;
  let timer = 0, resolve;
  const done = new Promise((r) => { resolve = r; });
  timer = setTimeout(() => resolve(), o.animate === false || still ? 0 : L.endAt);
  return {
    el, layout: L, done,
    remove() { clearTimeout(timer); resolve(); el.remove(); },
  };
}
