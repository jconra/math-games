// The times-table chart a kid can peek at when a times-table card has them stuck.
//
// Two pieces, both plain page elements laid over the game:
//   offerChart(container, opts)  a small "Peek at the chart" button that slides in under the rule card. It appears when
//                                the kid has gone quiet for a while or has just made a wrong pick. Clicking it opens
//                                the chart; the button comes back when the chart closes, until the card is over.
//   showChart(container, opts)   the chart itself: a panel on the left side of the screen (the middle, where the kid
//                                aims, stays clear) with the full grid, 1-10 across the top and down the left and all
//                                100 numbers filled in (1-12 when the 11s or 12s are in play). The current table's row
//                                and column are lit. After a wrong pick, the missed number is pinned in the gap where
//                                it would sit in that row, with one plain line ("27 sits between 24 and 30, so it isn't
//                                in the 6s"). On a missing-number card (7 x ? = 56) only the row is lit, and the line
//                                tells the kid how to read the answer off the chart rather than circling it.
//
// opts (both): { table, missed, size, find, rule, line, side, anchor, avoid, marks, onOpen, onClose }
//   table   the times table on the card (2 to 12)
//   missed  after a wrong pick: the number on the target the kid roped. On a missing-number card this is the number
//           they tried in place of the ? (they roped 9 for 7 x ? = 56).
//   size    10 or 12. Left out, it is worked out from the table, the missed number and `find` (see chartSize).
//   find    missing-number cards only: the product on the card (56 for 7 x ? = 56). Its presence makes it that kind.
//   rule    the card's own words ('7 × ? = 56'), used as the chart's heading on a missing-number card
//   line    the plain line under the grid, if the caller wants its own words instead of the chart's
//   side    'left' (default) or 'right': which edge of the screen the chart sits against
//   anchor  the rule card's element. The button sits just under it, centred on it, and the chart keeps out of its way
//           (below it or beside it) unless that would leave the numbers too small to read.
//   avoid   other elements to keep in view if the chart can (one element or a list): the hint line under the herd, say.
//           They give way before the rule card does, and never shrink the squares below KEEP_HINT_MIN (36 on a phone).
//   marks   the rider's own facts, coloured (src/math/facts.js chart(rider)): marks[r - 1][c - 1] = 'green' (answered
//           right), 'red' (missed: it comes back soon) or null (not asked yet). With marks the chart shows 12 x 12 and
//           a key (THE TIMES CHART from the tools button, src/ui/tools.js); a square's readout says how it went.
//   onOpen(chart), onClose()   called when the chart opens and closes (offerChart passes them through)
//
// update(opts) on the button or the chart only redraws an open chart when something it shows has changed. Options left
// out keep their old values, so a refresh with no miss keeps the last miss. Within one button's life the chart only ever
// grows (10 to 12), never shrinks, so the squares the kid is reading don't jump. Make a new button for each card.
//
// The chart closes with Esc, a click outside it (a drag to look around does not count), the x button, or a call to
// close() / closeChart(), which the game makes on the kid's next pick. isChartOpen() tells a game key handler that the
// chart is using Esc right now. It never pauses or blocks the game: a click outside it still reaches the game, so
// picking a steer both throws the rope and puts the chart away.
//
// Peeking is free. Nothing here touches gold, accuracy or the trainer.
//
// The pure helpers (chartGrid, chartSize, chartOptions, missPlace, chartWords, watchHesitation) need no page, so the
// node tests can check them; nothing touches the page until offerChart or showChart is called.

const CSS_HREF = new URL('./timeschart.css', import.meta.url).href;
const TIMES = '×';
// The events the chart and its button keep to themselves, so the game never reads them as a pick or a camera drag.
const SHIELD = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchend', 'wheel', 'contextmenu'];
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const word = (n) => WORDS[n] || String(n);
// How small (in pixels) the squares may get so something else stays in view. The rule card matters more than a hint
// line, so it may cost more. If the squares are already smaller than this, keeping a thing in view may not shrink them.
// A phone's pixels are physically much smaller, so there the hint line gets no more room than the rule card does.
const KEEP_CARD_MIN = 36;
const KEEP_HINT_MIN = 32;
const KEEP_HINT_MIN_PHONE = 36;

// ---------------------------------------------------------------------------------------------------------------------
// Pure helpers

// The numbers in the chart: rows[r - 1][c - 1] = r x c, for r and c from 1 to size.
export function chartGrid(size = 10) {
  const n = size === 12 ? 12 : 10;
  const rows = [];
  for (let r = 1; r <= n; r++) {
    const row = [];
    for (let c = 1; c <= n; c++) row.push(r * c);
    rows.push(row);
  }
  return rows;
}

// How big the chart should be: 12 when the 11s or 12s are on the card, when the trainer has the kid going up to x12,
// or when the number to find, the missed number or the answer the kid tried only shows up past x10 in this table.
// Otherwise 10, the chart the brief asks for. A size the caller passes (10 or 12) wins.
export function chartSize({ table, size, reach, find, missed, marks } = {}) {
  if (size === 10 || size === 12) return size;
  if (Array.isArray(marks)) return 12;
  const t = toTable(table);
  if (t >= 11) return 12;
  if (reach >= 11) return 12;
  if (t) {
    if (isNum(find) && find > t * 10 && find <= t * 12) return 12;
    // A wrong pick just past the end of the row (62 among the 6s up to x10) is easier to place with 66 in view.
    if (isNum(missed) && !isNum(find) && missed > t * 10 && missed < t * 12) return 12;
    // On a missing-number card `missed` is the answer the kid tried. A try of 11 or 12 (6 x 11 for 6 x ? = 48) needs
    // those columns, so the chart can ring 66 under the 11.
    if (isNum(find) && isNum(missed) && Math.round(missed) > 10 && Math.round(missed) <= 12) return 12;
  }
  return 10;
}

// The chart's options for a wave from the trainer (src/math/times.js), so the game doesn't have to know the details:
//   chartOptions(wave)        -> { table, size, find?, rule? }            when the kid has gone quiet
//   chartOptions(wave, 27)    -> { table, size, missed: 27, ... }         after a wrong pick of 27
// A missing-number wave carries its product only inside the card's words ('7 × ? = 56'), so it is read from there.
export function chartOptions(wave, missed) {
  const w = wave || {};
  const out = { table: toTable(w.table) };
  if (w.kind === 'missing') {
    const find = isNum(w.prod) ? w.prod : productFromRule(w.rule);
    if (isNum(find)) out.find = find;
    if (w.rule) out.rule = String(w.rule);
  }
  if (isNum(missed)) out.missed = missed;
  out.size = chartSize({ table: out.table, reach: w.reach, find: out.find, missed: out.missed });
  return out;
}

// '7 × ? = 56' or '? x 7 = 56' -> 56
export function productFromRule(rule) {
  const m = /=\s*(\d+)\s*$/.exec(String(rule || ''));
  return m ? Number(m[1]) : null;
}

// Where a missed number sits in a table's row of the chart.
//   kind 'gap'     it falls between two numbers of the row: `after` is the column it comes after (0 = before the first
//                  number), `before`/`next` are the row's numbers either side (24 and 30 for 27 in the 6s)
//   kind 'past'    it is past the end of the row on this chart (`last` is the row's last number)
//   kind 'in'      it IS in the table: `col` is its column (col > size means it is off the chart)
export function missPlace(table, missed, size = 10) {
  const t = toTable(table), n = Math.round(Number(missed));
  if (!t || !Number.isFinite(n) || n < 1) return null;
  const N = size === 12 ? 12 : 10;
  if (n % t === 0) return { kind: 'in', table: t, n, col: n / t, onChart: n / t <= N };
  const k = Math.floor(n / t);              // how many whole t's fit under n
  const prev = k * t, next = prev + t;
  if (k >= N) return { kind: 'past', table: t, n, after: N, prev, next, last: N * t };
  return { kind: 'gap', table: t, n, after: k, prev, next };
}

// All the words on the chart, worked out from the options. -> { kicker, title, line, note, tag }
//   line  the big plain line under the grid (the one the kid should read)
//   note  a smaller second line: how to use the chart
//   tag   the label pinned into the gap ('27'), or null
export function chartWords(opts = {}) {
  const t = toTable(opts.table);
  const size = chartSize(opts);
  const out = { kicker: 'Times table chart', title: t ? `The ${t}s` : 'Times tables', line: '', note: '', tag: null };
  if (!t) {
    out.line = 'Find the row on the left and the column on top. Where they meet is the answer.';
    if (Array.isArray(opts.marks)) {
      const n = markCount(opts.marks);
      out.title = 'Your times tables';
      out.line = n.green || n.red ? `Green: ${n.green} fact${n.green === 1 ? '' : 's'} you got right. Red: ${n.red} missed, and they come back soon.`
        : 'Facts you answer turn green when right and red when missed. Missed ones come back soon.';
      out.note = 'Find the row on the left and the column on top. Where they meet is the answer.';
    }
    return withOverride(out, opts);
  }
  if (isNum(opts.find)) {
    const p = opts.find;
    out.title = opts.rule ? tidyRule(opts.rule) : `${t} ${TIMES} ? = ${p}`;
    const how = `Slide along the ${t}s row to ${p}, then look straight up. The number at the top is the missing number.`;
    const k = isNum(opts.missed) ? Math.round(opts.missed) : null;
    if (k != null && k >= 1 && t * k !== p) {
      const d = Math.abs(t * k - p) / t;
      const off = Number.isInteger(d)
        ? `${word(d)} ${t}${d > 1 ? 's' : ''} ${t * k > p ? 'too many' : 'short'}`
        : (t * k > p ? 'too big' : 'too small');
      out.line = `${t} ${TIMES} ${k} = ${t * k}, ${off}.`;
      out.note = how;
    } else {
      out.line = how;
      out.note = `The ${t}s row is lit.`;
    }
    return withOverride(out, opts);
  }
  const place = isNum(opts.missed) ? missPlace(t, opts.missed, size) : null;
  if (!place) {
    out.line = `Every number in the ${t}s row is in the ${t}-herd.`;
    out.note = `The ${t}s column, going down, has the same numbers.`;
    return withOverride(out, opts);
  }
  const n = place.n;
  out.note = `Every number in the ${t}s row is in the ${t}-herd.`;
  if (place.kind === 'in') {
    out.line = `${n} is in the ${t}s: ${t} ${TIMES} ${place.col} = ${n}.`;
  } else if (place.kind === 'gap' && place.after === 0) {
    out.tag = String(n);
    out.line = `${n} is smaller than ${t}, the first number in the ${t}s, so it isn't in the ${t}s.`;
  } else if (place.kind === 'gap') {
    out.tag = String(n);
    out.line = `${n} sits between ${place.prev} and ${place.next}, so it isn't in the ${t}s.`;
  } else {
    out.tag = String(n);
    out.line = place.prev === place.last
      ? `${n} sits between ${place.prev} and ${place.next} (${t} ${TIMES} ${place.after + 1}, just off the chart), so it isn't in the ${t}s.`
      : `${n} sits between ${place.prev} and ${place.next}, past the end of this chart, so it isn't in the ${t}s.`;
  }
  return withOverride(out, opts);
}

// The "still thinking?" timer: watchHesitation({ after = 8000, onShow }) -> { answered(), cancel(), restart() }.
// Starts at once. If `after` ms go by with no answered() or cancel(), onShow() is called (once). answered() and cancel()
// both stop it (answered is the one to call when the kid picks; cancel when the card goes away). restart() starts the
// wait again from now: after a pick on a card that still has numbers left to rope, or for the next card.
// It works exactly like the number line's watchHesitation (src/ui/numberline.js), so a round-up can use either one.
export function watchHesitation({ after = 8000, onShow } = {}) {
  let timer = null, fired = false;
  const clear = () => { if (timer != null) { clearTimeout(timer); timer = null; } };
  const arm = () => {
    clear();
    fired = false;
    timer = setTimeout(() => {
      timer = null;
      if (fired) return;
      fired = true;
      try { if (typeof onShow === 'function') onShow(); } catch (e) { console.error(e); }
    }, Math.max(0, Number(after) || 0));
  };
  arm();
  return {
    answered: clear,
    cancel: clear,
    restart: arm,
    get waiting() { return timer != null; },
    get shown() { return fired; },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The page parts

let cssReady = null;
// Adds the chart's stylesheet once. The game can call this early so the first peek has no wait.
export function ensureChartCss() {
  if (cssReady) return cssReady;
  if (typeof document === 'undefined') return (cssReady = Promise.resolve());
  if (document.querySelector('link[data-timeschart-css]')) return (cssReady = Promise.resolve());
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = CSS_HREF;
  link.dataset.timeschartCss = '1';
  cssReady = new Promise((res) => {
    link.addEventListener('load', res);
    link.addEventListener('error', res);
    setTimeout(res, 3000);
  });
  document.head.appendChild(link);
  return cssReady;
}

let current = null;   // the chart that is open now (only one at a time)

// Closes whatever chart is open. The game calls this on the kid's next pick.
export function closeChart() { if (current) current.close(); }

// True while a chart is open. The chart closes on Esc with a window listener in the capture phase, but a game listener
// added the same way earlier (at boot) still runs first, so it should leave Esc alone while this is true.
export function isChartOpen() { return !!(current && current.open); }

// Opens the chart. Returns { el, close(), update(opts), open } (open is false once it has closed).
export function showChart(container, opts = {}) {
  if (current) current.close(true);
  ensureChartCss();
  const host = container || document.body;
  const o = { ...opts };
  const root = document.createElement('div');
  root.className = 'tch';
  root.dataset.side = o.side === 'right' ? 'right' : 'left';
  root.style.opacity = '0';   // stays invisible until the stylesheet has loaded
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Times table chart');
  host.appendChild(root);

  const api = { el: root, open: true, close, update };
  let size = 10;
  let read = null;            // the "6 x 4 = 24" readout line
  let hot = null;             // the square being pointed at (or last tapped): { r, c }
  let shownAt = now();

  function render() {
    size = chartSize(o);
    root.dataset.side = o.side === 'right' ? 'right' : 'left';
    const t = toTable(o.table);
    const words = chartWords({ ...o, size });
    const isFind = isNum(o.find);
    const place = !isFind && isNum(o.missed) ? missPlace(t, o.missed, size) : null;
    // On a missing-number card: the wrong answer the kid tried (0 if none), and its column when it is on the chart.
    const tried = isFind && t && isNum(o.missed) && Math.round(o.missed) >= 1 && t * Math.round(o.missed) !== o.find
      ? Math.round(o.missed) : 0;
    const wrongCol = tried <= size ? tried : 0;
    root.classList.toggle('is-find', isFind);
    root.style.setProperty('--n', String(size + 1));

    const cells = [];
    // the top row: the corner, then 1..size
    cells.push(`<div class="tch-tr" role="row"><span class="tch-corner" role="columnheader" aria-label="times">${TIMES}</span>`);
    for (let c = 1; c <= size; c++) cells.push(`<span class="tch-h tch-top${c === t && !isFind ? ' lit' : ''}${c === wrongCol ? ' miss' : ''}" role="columnheader" data-c="${c}">${c}</span>`);
    cells.push('</div>');
    for (let r = 1; r <= size; r++) {
      cells.push(`<div class="tch-tr" role="row"><span class="tch-h tch-left${r === t ? ' lit' : ''}" role="rowheader" data-r="${r}">${r}</span>`);
      for (let c = 1; c <= size; c++) {
        const cls = ['tch-c'];
        if (r === t) cls.push('row');
        if (c === t && !isFind) cls.push('col');
        if (r === c) cls.push('sq');
        if (c === 5) cls.push('five');          // a stronger line after x5: counting on from 5 x t is a handy anchor
        if (r === 5) cls.push('fiveR');
        if (place && place.kind === 'gap' && r === t && (c === place.after || c === place.after + 1)) cls.push('side');
        if (place && place.kind === 'past' && r === t && c === size) cls.push('side');
        if (place && place.kind === 'in' && r === t && c === place.col) cls.push('found');
        if (wrongCol && r === t && c === wrongCol) cls.push('wrong');
        const mk = markAt(o.marks, r, c);
        if (mk) cls.push(mk === 'green' ? 'is-green' : 'is-red');
        cells.push(`<span class="${cls.join(' ')}" role="cell" data-r="${r}" data-c="${c}">${r * c}</span>`);
      }
      cells.push('</div>');
    }
    // The missed number, pinned into the gap where it would sit in the row. It lives on a see-through grid of the
    // same shape laid over the numbers, so placing it can't push any number out of its square.
    const over = [];
    if (place && place.kind !== 'in' && words.tag) {
      const gridRow = t + 1;
      if (place.kind === 'gap') {
        const startCol = place.after + 1;            // grid column of the square before the gap (1 = the header column)
        over.push(`<i class="tch-gapline" style="grid-row:${gridRow};grid-column:${startCol + 1}"></i>`);
        over.push(`<b class="tch-tag" style="grid-row:${gridRow};grid-column:${startCol} / span 2">${esc(words.tag)}</b>`);
      } else {
        over.push(`<i class="tch-gapline end" style="grid-row:${gridRow};grid-column:${size + 1}"></i>`);
        over.push(`<b class="tch-tag end" style="grid-row:${gridRow};grid-column:${size + 1}">${esc(words.tag)}</b>`);
      }
    }

    root.innerHTML = `
      <div class="tch-panel">
        <div class="tch-head">
          <div class="tch-kick">${esc(words.kicker)}</div>
          <h2 class="tch-title">${esc(words.title)}</h2>
          <button class="tch-x" type="button" aria-label="Close the chart" title="Close (Esc, or click outside)">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
            <kbd class="tch-esc">Esc</kbd>
          </button>
        </div>
        <div class="tch-paper"><div class="tch-gridwrap">
          <div class="tch-grid" role="table" aria-label="Times table, 1 to ${size}">${cells.join('')}</div>
          ${over.length ? `<div class="tch-over" aria-hidden="true">${over.join('')}</div>` : ''}
        </div></div>
        <div class="tch-words">
          <p class="tch-line${(place && place.kind !== 'in') || tried ? ' is-miss' : ''}">${esc(words.line)}</p>
          ${words.note ? `<p class="tch-note">${esc(words.note)}</p>` : ''}
          <div class="tch-foot">
            <p class="tch-read" aria-live="polite">${idleRead()}</p>
            ${Array.isArray(o.marks) ? '<p class="tch-key tch-key-marks"><i class="tch-sw is-green" aria-hidden="true"></i><span>right</span><i class="tch-sw is-red" aria-hidden="true"></i><span>missed</span></p>'
              : '<p class="tch-key"><i class="tch-sw" aria-hidden="true"></i><span>a number times itself</span></p>'}
          </div>
        </div>
      </div>`;
    read = root.querySelector('.tch-read');
    root.querySelector('.tch-x').addEventListener('click', (e) => { e.stopPropagation(); close(); });
    fit();
    if (hot) point(hot.r, hot.c);   // a redraw keeps the fact the kid was reading
  }

  // Sizes the grid to the screen: as big as fits, never so small the numbers stop being readable. It measures what
  // the frame and the words take up around the grid, then works out the biggest square that fits in the room it has.
  // When the rule card (`anchor`) is known, that room is below it or beside it, so the card stays in view. If keeping
  // the whole card clear would make the numbers too small, the chart may lie over the card's edge but still keeps clear
  // of its words, and only if even that is too costly (a phone on its side) may it cover the card. Anything in `avoid`
  // (the hint line under the herd) is kept in view the same way, if that costs less.
  function fit() {
    const panel = root.querySelector('.tch-panel');
    const grid = root.querySelector('.tch-grid');
    const vw = window.innerWidth, vh = window.innerHeight;
    const n = size + 1;
    const short = vh < 560;                 // a phone on its side: the words go beside the grid
    root.classList.toggle('is-short', short);
    const m = short ? 8 : vw < 700 ? 10 : 20;
    const rowF = short || size === 12 ? 0.8 : 0.84;   // rows a little shorter than they are wide
    const maxCell = vw >= 1500 && vh >= 900 ? 62 : 56;
    // how wide the panel may get: on a computer screen it stays in its half, so the middle (where the kid aims) is clear
    const capW = short ? vw * 0.74 : vw < 900 ? vw : vw * 0.48;
    const right = root.dataset.side === 'right';
    const setCell = (c) => root.style.setProperty('--cell', c + 'px');
    root.style.setProperty('--rowf', String(rowF));
    const full = { l: m, t: m, r: vw - m, b: vh - m };
    const pad = (rg) => { root.style.padding = `${rg.t}px ${vw - rg.r}px ${vh - rg.b}px ${rg.l}px`; };
    if (!panel || !grid || !cssLoaded()) { setCell(short ? 30 : 40); pad(full); return; }

    // Measure the panel at its real height. The stylesheet caps it at the height of its room, and a capped panel looks
    // as if it fits while its words spill out past the frame. The cap goes back on at the end.
    panel.style.maxHeight = 'none';
    root.classList.remove('is-cramped');
    setCell(40);
    let ch = chrome();
    const cellFor = (rg) => Math.floor(Math.min((rg.b - rg.t - ch.h) / (n * rowF), (Math.min(rg.r - rg.l, capW) - ch.w) / n));
    let best = { rg: full, cell: cellFor(full) };
    // The rule card first, then the things in `avoid`: each one is kept in view if the squares stay at least `min` big
    // (or, when they are already smaller than that, if they don't shrink at all). Each is tried whole first, then just
    // its words, so the chart may lie over a card's edge and padding rather than over what it says.
    for (const { boxes, min } of keepInView()) {
      for (const box of boxes) {
        const ways = clearOf(best.rg, box);
        if (!ways) break;                     // the chart can't reach it (or its words) anyway
        let kb = null;
        for (const rg of ways) { const c = cellFor(rg); if (!kb || c > kb.cell) kb = { rg, cell: c }; }
        if (kb && kb.cell >= Math.min(best.cell, min)) { best = kb; break; }
      }
    }
    pad(best.rg);
    const clampCell = (c) => Math.max(20, Math.min(maxCell, c));
    let cell = clampCell(best.cell);
    setCell(cell);
    // the words wrap differently at the new size: measure again and settle
    for (let i = 0; i < 4; i++) {
      ch = chrome();
      const want = clampCell(cellFor(best.rg));
      if (want === cell) break;
      cell = want;
      setCell(cell);
    }
    // last word: shrink until the panel truly fits its room
    const roomW = Math.min(best.rg.r - best.rg.l, capW), roomH = best.rg.b - best.rg.t;
    let fits = false;
    for (let i = 0; i < 16; i++) {
      const r = panel.getBoundingClientRect();
      fits = r.width <= roomW + 0.5 && r.height <= roomH + 0.5;
      if (fits || cell <= 20) break;
      cell--;
      setCell(cell);
    }
    panel.style.maxHeight = '';
    // a very small screen where even the smallest squares don't fit: the panel scrolls rather than spill
    root.classList.toggle('is-cramped', !fits);

    function chrome() {
      const p = panel.getBoundingClientRect(), g = grid.getBoundingClientRect();
      return { w: p.width - g.width, h: p.height - g.height };
    }
    // The things to keep in view (the rule card, then `avoid`), skipping any that are hidden or off the screen. Each
    // gives its whole box, then the smaller box around just its words when that is different.
    function keepInView() {
      const out = [];
      const add = (el, min) => {
        if (!el || !el.isConnected || !el.getBoundingClientRect) return;
        const b = el.getBoundingClientRect();
        if (!(b.width && b.height && b.bottom > 0 && b.top < vh && b.right > 0 && b.left < vw)) return;
        const w = wordsBox(el, b);
        out.push({ boxes: w ? [b, w] : [b], min });
      };
      add(o.anchor, KEEP_CARD_MIN);
      for (const el of listOf(o.avoid)) add(el, short ? KEEP_HINT_MIN_PHONE : KEEP_HINT_MIN);
      return out;
    }
    // The ways to trim the room `rg` so the panel can't cover `box`: stop above it, start below it, or stay beside it
    // (on the chart's side of the screen). null when the panel can't reach the box from that room.
    function clearOf(rg, box) {
      const reachL = right ? Math.max(rg.l, rg.r - capW) : rg.l;
      const reachR = right ? rg.r : Math.min(rg.r, rg.l + capW);
      if (box.right <= reachL || box.left >= reachR || box.bottom <= rg.t || box.top >= rg.b) return null;
      const ways = [];
      if (box.top - 10 > rg.t) ways.push({ ...rg, b: Math.min(rg.b, Math.round(box.top - 10)) });
      if (box.bottom + 10 < rg.b) ways.push({ ...rg, t: Math.max(rg.t, Math.round(box.bottom + 10)) });
      if (right && box.right + 12 < rg.r) ways.push({ ...rg, l: Math.max(rg.l, Math.round(box.right + 12)) });
      if (!right && box.left - 12 > rg.l) ways.push({ ...rg, r: Math.min(rg.r, Math.round(box.left - 12)) });
      return ways;
    }
  }

  function cssLoaded() {
    const cs = getComputedStyle(root);
    return cs.position === 'fixed';
  }

  // Everything the chart shows, as one string. An update that leaves it the same doesn't redraw: a redraw replays the
  // tag's drop-in and can change the size while the kid is reading.
  function looks(x) {
    return JSON.stringify([toTable(x.table), isNum(x.missed) ? Math.round(x.missed) : null, isNum(x.find) ? x.find : null,
      x.rule ? String(x.rule) : '', typeof x.line === 'string' ? x.line : '', x.side === 'right' ? 'right' : 'left', chartSize(x),
      Array.isArray(x.marks) ? x.marks : null]);
  }

  // New options. Redraws only if something on the chart changes; a new rule card or hint line to keep clear of only
  // moves it. Returns true if it redrew.
  function update(next = {}) {
    if (!api.open) return false;
    const was = looks(o), anchor = o.anchor, avoid = listOf(o.avoid);
    Object.assign(o, next);
    if (looks(o) !== was) { render(); return true; }
    const avoidNow = listOf(o.avoid);
    if (o.anchor !== anchor || avoidNow.length !== avoid.length || avoidNow.some((el, i) => el !== avoid[i])) fit();
    return false;
  }

  // The readout: point at (or tap) a number to see its fact, and light its row and column numbers.
  function point(r, c) {
    for (const h of root.querySelectorAll('.tch-h.hot, .tch-c.hot')) h.classList.remove('hot');
    const cell = r && c ? root.querySelector(`.tch-c[data-r="${r}"][data-c="${c}"]`) : null;
    if (!cell || !read) {
      hot = null;
      if (read) read.innerHTML = idleRead();
      return;
    }
    hot = { r, c };
    cell.classList.add('hot');
    const top = root.querySelector(`.tch-top[data-c="${c}"]`), left = root.querySelector(`.tch-left[data-r="${r}"]`);
    if (top) top.classList.add('hot');
    if (left) left.classList.add('hot');
    const mk = markAt(o.marks, r, c);
    read.innerHTML = `<b>${r}</b> ${TIMES} <b>${c}</b> = <b>${r * c}</b>${mk === 'green' ? ' <span class="tch-said is-green">right</span>' : mk === 'red' ? ' <span class="tch-said is-red">missed: it comes back soon</span>' : ''}`;
  }
  root.addEventListener('pointerover', (e) => {
    const cell = e.target.closest && e.target.closest('.tch-c');
    if (cell) point(Number(cell.dataset.r), Number(cell.dataset.c)); else point(0, 0);
  });
  // A mouse leaving the chart puts the readout back. A finger lifting off the glass doesn't: on a touch screen the
  // last number tapped stays up until the next tap.
  root.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') point(0, 0); });
  // Clicks, taps and scrolls on the chart stay on the chart: pointing at a number must never also throw a rope or
  // turn the camera, even if the game listens on the whole page.
  for (const type of SHIELD) root.addEventListener(type, (e) => { if (e.target.closest && e.target.closest('.tch-panel')) e.stopPropagation(); }, { passive: true });

  // Closing: Esc, or a click (not a drag) outside the panel. The click still reaches the game.
  let down = null;
  const onKey = (e) => {
    if (e.key !== 'Escape' || !api.open) return;
    e.stopPropagation();
    e.preventDefault();
    close();
  };
  const onDown = (e) => {
    const panel = root.querySelector('.tch-panel');
    down = panel && panel.contains(e.target) ? null : { x: e.clientX, y: e.clientY, t: now() };
  };
  const onUp = (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = now() - down.t < 600;
    down = null;
    // ignore the very click that opened the chart
    if (moved < 8 && quick && now() - shownAt > 150) close();
  };
  const onResize = () => fit();
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('resize', onResize);

  function close(fast = false) {
    if (!api.open) return;
    api.open = false;
    if (current === api) current = null;
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('pointerdown', onDown, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('resize', onResize);
    root.classList.remove('in');
    root.classList.add('out');
    const gone = () => { if (root.parentNode) root.parentNode.removeChild(root); };
    if (fast || reducedMotion()) gone(); else setTimeout(gone, 240);
    if (typeof o.onClose === 'function') o.onClose();
  }

  render();
  current = api;
  ensureChartCss().then(() => {
    if (!api.open) return;
    root.style.opacity = '';
    fit();
    requestAnimationFrame(() => requestAnimationFrame(() => { if (api.open) root.classList.add('in'); }));
  });
  // the game's fonts change how the words wrap: fit again once they have all arrived
  if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => { if (api.open) fit(); });
  shownAt = now();
  if (typeof o.onOpen === 'function') o.onOpen(api);
  return api;
}

// The "Peek at the chart" button. Returns { el, remove(), update(opts), openChart(), closeChart(), chart }.
//   update(opts)  new options (a fresh miss, say): changes the button's small line and any open chart
//   remove()      takes the button away (and closes the chart): call it when the card is over
export function offerChart(container, opts = {}) {
  ensureChartCss();
  const host = container || document.body;
  const o = { ...opts };
  let size = chartSize(o);   // the size the chart is drawn at: it only ever grows while this button is up
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tch-offer';
  btn.style.opacity = '0';
  host.appendChild(btn);
  const api = { el: btn, chart: null, remove, update, openChart, closeChart: () => { if (api.chart) api.chart.close(); } };
  let gone = false;

  function label() {
    const t = toTable(o.table);
    let small = t ? `the ${t}s, lit up` : 'every table, 1 to 10';
    if (isNum(o.find) && t) small = `find ${o.find} in the ${t}s`;
    else if (isNum(o.missed) && t) {
      const p = missPlace(t, o.missed, size);
      small = p && p.kind !== 'in' ? `see where ${Math.round(o.missed)} sits` : `the ${t}s, lit up`;
    }
    btn.setAttribute('aria-label', `Peek at the times table chart: ${small}`);
    btn.innerHTML = `
      <svg class="tch-offer-ico" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/>
        <path d="M3 9h18M3 15h18M9 3v18M15 3v18" stroke="currentColor" stroke-width="1.2" opacity=".75"/>
        <rect x="3.8" y="9.6" width="16.4" height="4.8" fill="currentColor" opacity=".38"/>
      </svg>
      <span class="tch-offer-words"><b>Peek at the chart</b><small>${esc(small)}</small></span>`;
  }

  function place() {
    const a = o.anchor;
    if (!a || !a.getBoundingClientRect || !a.isConnected) { btn.classList.remove('is-anchored'); btn.style.top = ''; btn.style.left = ''; return; }
    const r = a.getBoundingClientRect();
    btn.classList.add('is-anchored');
    btn.style.top = Math.round(r.bottom + 10) + 'px';
    btn.style.left = Math.round(r.left + r.width / 2) + 'px';
  }

  function openChart() {
    if (gone) return null;
    if (api.chart && api.chart.open) return api.chart;
    btn.classList.add('is-away');
    api.chart = showChart(host, {
      ...o,
      size,
      onOpen: (c) => { if (typeof o.onOpen === 'function') o.onOpen(c); },
      onClose: () => {
        api.chart = null;
        if (!gone) btn.classList.remove('is-away');
        if (typeof o.onClose === 'function') o.onClose();
      },
    });
    return api.chart;
  }

  // A refresh with no miss (the wait running out after a wrong pick, say) keeps the last miss, because `missed` is only
  // replaced when it is given, and it can't shrink the chart. An open chart only redraws if what it shows has changed.
  function update(next = {}) {
    if (gone) return;
    Object.assign(o, next);
    size = Math.max(size, chartSize(o));
    label();
    place();
    if (api.chart && api.chart.open) {
      const { onOpen, onClose, ...rest } = next;
      api.chart.update({ ...rest, size });
    }
    // a fresh nudge, so a new miss is noticed
    btn.classList.remove('nudge');
    void btn.offsetWidth;
    btn.classList.add('nudge');
  }

  function remove() {
    if (gone) return;
    gone = true;
    window.removeEventListener('resize', place);
    if (api.chart) api.chart.close(true);
    btn.classList.remove('in');
    btn.classList.add('out');
    setTimeout(() => { if (btn.parentNode) btn.parentNode.removeChild(btn); }, reducedMotion() ? 0 : 220);
  }

  // keep the click on the button from also reaching the game as a pick
  for (const type of SHIELD) btn.addEventListener(type, (e) => e.stopPropagation(), { passive: true });
  // Let go of keyboard focus once clicked, so Enter or Space (game keys) can't press it again behind the kid's back.
  btn.addEventListener('click', () => { openChart(); btn.blur(); });
  window.addEventListener('resize', place);
  label();
  place();
  ensureChartCss().then(() => {
    if (gone) return;
    btn.style.opacity = '';
    place();
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!gone) btn.classList.add('in', 'nudge'); }));
  });
  return api;
}

// ---------------------------------------------------------------------------------------------------------------------
// Small helpers

function isNum(x) { return typeof x === 'number' && Number.isFinite(x); }
// a fact's colour on the rider's own chart (either way round: 7 x 8 is 8 x 7), or null
function markAt(marks, r, c) {
  if (!Array.isArray(marks)) return null;
  const m = (marks[r - 1] && marks[r - 1][c - 1]) || (marks[c - 1] && marks[c - 1][r - 1]) || null;
  return m === 'green' || m === 'red' ? m : null;
}
// how many facts are green and red (each fact once: 7 x 8 and 8 x 7 together)
export function markCount(marks) {
  const out = { green: 0, red: 0 };
  if (!Array.isArray(marks)) return out;
  for (let r = 1; r <= 12; r++) for (let c = r; c <= 12; c++) { const m = markAt(marks, r, c); if (m) out[m]++; }
  return out;
}
function toTable(t) { const n = Math.round(Number(t)); return n >= 1 && n <= 12 ? n : 0; }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function tidyRule(rule) { return String(rule).replace(/\s*[x*]\s*/g, ` ${TIMES} `).replace(/\s+/g, ' ').trim(); }
function withOverride(out, opts) { if (typeof opts.line === 'string' && opts.line) out.line = opts.line; return out; }
// The box around the words inside an element (its text, without the frame and padding around it), kept inside the
// element's own box `frame`. null when it has no words on screen or the words fill the whole box anyway.
function wordsBox(el, frame) {
  if (typeof document === 'undefined' || !document.createTreeWalker || !document.createRange) return null;
  const walk = document.createTreeWalker(el, 4 /* text only */);
  const rg = document.createRange();
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (let node = walk.nextNode(); node; node = walk.nextNode()) {
    if (!node.nodeValue.trim()) continue;
    rg.selectNodeContents(node);
    for (const x of rg.getClientRects()) {
      if (!x.width || !x.height) continue;
      l = Math.min(l, x.left); t = Math.min(t, x.top); r = Math.max(r, x.right); b = Math.max(b, x.bottom);
    }
  }
  l = Math.max(l, frame.left); t = Math.max(t, frame.top); r = Math.min(r, frame.right); b = Math.min(b, frame.bottom);
  if (!(r > l && b > t)) return null;
  if (l <= frame.left + 1 && t <= frame.top + 1 && r >= frame.right - 1 && b >= frame.bottom - 1) return null;
  return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t };
}
// one element, a list of them, or nothing -> a plain list
function listOf(x) { return !x ? [] : Array.isArray(x) ? x.filter(Boolean) : x.nodeType ? [x] : typeof x.length === 'number' ? [...x] : [x]; }
// what the readout says while nothing is pointed at ("tap" on a screen with no mouse)
function idleRead() {
  let tap = false;
  try { tap = typeof matchMedia === 'function' && matchMedia('(hover: none)').matches; } catch { tap = false; }
  return `<span class="tch-read-idle">${tap ? 'Tap' : 'Point at'} a number to read it.</span>`;
}
function now() { return (typeof performance !== 'undefined' ? performance : Date).now(); }
function reducedMotion() {
  try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
