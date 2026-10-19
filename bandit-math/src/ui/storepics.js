// The pictures for the store's word problems: one drawing for each KIND of problem (src/math/wordproblems.js), shown on
// the order slip after a wrong pick, or when the kid asks to see it drawn. It shows how the story is built (groups of
// dots, a sharing split, a road with mile markers, bars side by side) with a "?" where the answer goes: it never shows
// the answer itself, so the kid still works it out.
//
//   picture(pic) -> { svg, title, line }   pic = an order's .pic; svg = an <svg> string (scales to its box, ink colours
//                                          for the parchment), title = the kind's name, line = one plain sentence for it
// Plain strings, no page needed (tests/wordproblems.test.mjs draws every kind).
// Two pictures are different: 'things' (the youngest riders' picture stories) draws the apples or eggs themselves, to
// count: counting them IS the skill there, so it shows from the start; 'lots' (a big order) draws a few of the lots and
// says the sum to work out on paper.

const INK = '#2b2219', SOFT = '#8a7558', FILL = '#ead9b2', FILL2 = '#d9bf8a', BRASS = '#b47f2c', ASK = '#b5523a', GREEN = '#5d7a3a';
const W = 360;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const u = (n, unit) => `${n} ${n === 1 ? unit[0] : unit[1]}`;
const cash = (n, cents) => (cents ? `${n}¢` : `$${n}`);
const val = (n, unit, cents) => (unit === 'money' ? cash(n, cents) : String(n));
const text = (x, y, s, { size = 13, fill = INK, anchor = 'middle', weight = 600 } = {}) =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="Bitter, Georgia, serif">${esc(s)}</text>`;
const q = (x, y, size = 18) => text(x, y, '?', { size, fill: ASK, weight: 800 });
const svg = (h, body) => `<svg viewBox="0 0 ${W} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" class="bmp-svg">${body}</svg>`;
// a bar from x0 to x1 at y with a label in it
const bar = (x0, x1, y, h, label, { fill = FILL, stroke = INK, ask = false, dash = false } = {}) =>
  `<rect x="${x0.toFixed(1)}" y="${y}" width="${Math.max(2, x1 - x0).toFixed(1)}" height="${h}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="1.4"${dash ? ' stroke-dasharray="4 3"' : ''}/>`
  + (ask ? q((x0 + x1) / 2, y + h / 2 + 6) : label == null ? '' : text((x0 + x1) / 2, y + h / 2 + 5, label, { size: 13 }));
// a bracket over (or under) x0..x1 with a label
const brace = (x0, x1, y, label, { up = true, ask = false } = {}) => {
  const d = up ? -6 : 6;
  return `<path d="M${x0} ${y}v${d}H${x1}v${-d}" fill="none" stroke="${SOFT}" stroke-width="1.3"/>`
    + (ask ? q((x0 + x1) / 2, up ? y - 10 : y + 24) : text((x0 + x1) / 2, up ? y - 10 : y + 20, label, { size: 13 }));
};

const DRAW = {
  // groups of dots: a circles, b dots in each (a bar of equal boxes when there are too many to draw)
  groups(p) {
    const a = p.groups, b = p.each, money = p.unit === 'money';
    const each = money ? cash(b, p.cents) : u(b, p.unit);
    const item = p.item ? p.item[a === 1 ? 0 : 1] : 'groups';
    const line = `${a} ${item}, ${each} each: ${Array(Math.min(a, 6)).fill(money ? cash(b, p.cents) : b).join(' + ')}${a > 6 ? ' + …' : ''} = ?`;
    if (a <= 9 && b <= 12) {
      const perRow = a <= 5 ? a : Math.ceil(a / 2), rows = Math.ceil(a / perRow), R = 26, gap = (W - 20) / perRow;
      let s = '';
      for (let i = 0; i < a; i++) {
        const cx = 10 + gap * (i % perRow + 0.5), cy = 36 + Math.floor(i / perRow) * 66;
        s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${FILL}" stroke="${INK}" stroke-width="1.4"/>`;
        const cols = b <= 4 ? b : b <= 9 ? 3 : 4, rws = Math.ceil(b / cols);
        for (let k = 0; k < b; k++) {
          const dx = (k % cols - (cols - 1) / 2) * 9.5, dy = (Math.floor(k / cols) - (rws - 1) / 2) * 9.5;
          s += `<circle cx="${(cx + dx).toFixed(1)}" cy="${(cy + dy).toFixed(1)}" r="3.4" fill="${BRASS}"/>`;
        }
        s += text(cx, cy + R + 13, money ? cash(b, p.cents) : String(b), { size: 12, fill: SOFT });
      }
      const h = 36 + (rows - 1) * 66 + R + 40;
      return { svg: svg(h, s + text(W - 12, h - 3, 'in all: ?', { size: 14, anchor: 'end', fill: ASK, weight: 800 })), line };
    }
    let s = '';
    const bw = (W - 20) / a;
    for (let i = 0; i < a; i++) s += bar(10 + i * bw, 10 + (i + 1) * bw - 2, 38, 32, money ? cash(b, p.cents) : String(b));
    s += brace(10, W - 10, 32, '', { ask: true });
    return { svg: svg(80, s), line };
  },
  // sharing: the whole on top, split into equal parts each "?"; whole crates: full ones and the leftover that needs one too
  share(p) {
    if (p.crates) {
      const per = p.per, total = p.total, full = Math.floor(total / per), left = total - full * per;
      const x0 = 10, x1 = W - 10, scale = (x1 - x0) / total;
      let s = bar(x0, x1, 22, 26, `${total} in all`, { fill: FILL2 });
      const shown = Math.min(2, full);
      for (let i = 0; i < shown; i++) s += bar(x0 + i * per * scale, x0 + (i + 1) * per * scale - 2, 62, 30, `${per}`);
      const mid0 = x0 + shown * per * scale, lastX = x1 - left * scale;
      if (full > shown) s += `<rect x="${mid0.toFixed(1)}" y="62" width="${(lastX - mid0 - 2).toFixed(1)}" height="30" rx="3" fill="none" stroke="${INK}" stroke-width="1.4" stroke-dasharray="4 3"/>` + text((mid0 + lastX) / 2, 82, `more ${p.box[1]} of ${per}…`, { size: 12, fill: SOFT });
      s += bar(lastX, x1, 62, 30, null, { fill: '#f3c9b4', stroke: ASK });
      s += text(x1 - 2, 112, left === 1 ? `the last one: it needs a ${p.box[0]} too` : `the last ${left}: they need a ${p.box[0]} too`, { size: 12, anchor: 'end', fill: ASK, weight: 700 });
      return { svg: svg(122, s), line: `${total} split into ${p.box[1]} of ${per}. Every ${p.box[0]} holds ${per}; the few left over still need one. How many ${p.box[1]}?` };
    }
    const g = p.groups, x0 = 10, x1 = W - 10, bw = (x1 - x0) / g;
    let s = bar(x0, x1, 24, 28, `${u(p.total, p.thing)}`, { fill: FILL2 });
    for (let i = 0; i < g; i++) {
      s += `<path d="M${(x0 + bw * (i + 0.5)).toFixed(1)} 56 v12" stroke="${SOFT}" stroke-width="1.2" marker-end="url(#bmp-ar)"/>`;
      s += bar(x0 + i * bw + 2, x0 + (i + 1) * bw - 2, 72, 30, null, { ask: true }) + q(x0 + bw * (i + 0.5), 93);
      if (g <= 6) s += text(x0 + bw * (i + 0.5), 118, p.box[0], { size: 11, fill: SOFT });
    }
    const defs = `<defs><marker id="bmp-ar" markerWidth="7" markerHeight="7" refX="3.5" refY="5" orient="auto"><path d="M0 0L7 0L3.5 6Z" fill="${SOFT}"/></marker></defs>`;
    return { svg: svg(g <= 6 ? 126 : 112, defs + s), line: `${p.total} shared into ${g} equal parts, one for each ${p.box[0]}. Each part is the same: ? (${g} × ? = ${p.total})` };
  },
  // a total and its parts as a bar
  parts(p) {
    const money = p.unit === 'money', v = (n) => val(n, p.unit, p.cents);
    const [a, b] = p.parts, labels = p.labels || ['', ''];
    const known = p.whole != null ? p.whole : a + b;
    const x0 = 10, x1 = W - 10, scale = (x1 - x0) / known;
    const aw = a != null ? a * scale : (known - b) * scale;
    let s = bar(x0, x1, 18, 28, p.whole != null ? v(p.whole) + (labels[0] ? ' paid' : ' in all') : null, { fill: FILL2, ask: p.whole == null });
    s += bar(x0, x0 + aw - 2, 64, 30, a != null ? v(a) : null, { ask: a == null });
    s += bar(x0 + aw, x1, 64, 30, b != null ? v(b) : null, { ask: b == null });
    if (labels[0]) s += text(x0 + aw / 2, 110, labels[0], { size: 12, fill: SOFT }) + text((x0 + aw + x1) / 2, 110, labels[1], { size: 12, fill: SOFT });
    const line = p.whole == null ? `The two parts side by side make the whole: ${v(a)} and ${v(b)} together.`
      : `The whole bar is ${v(p.whole)}. One part is ${v(a ?? b)}; the other part is the rest.`;
    return { svg: svg(labels[0] ? 118 : 104, s), line: money && labels[0] ? `What was paid = the price + the change. ${v(p.whole)} is the whole bar; ${v(a ?? b)} of it is the price.` : line };
  },
  // two bars lined up, and the gap between them
  compare(p) {
    const x0 = 10, x1 = W - 40, scale = (x1 - x0) / p.big, sx = x0 + p.small * scale;
    let s = bar(x0, x1, 16, 28, String(p.big), { fill: FILL2 });
    s += bar(x0, sx, 60, 28, String(p.small));
    s += `<rect x="${sx + 1}" y="60" width="${(x1 - sx - 1).toFixed(1)}" height="28" rx="3" fill="none" stroke="${ASK}" stroke-width="1.4" stroke-dasharray="4 3"/>`;
    s += q((sx + x1) / 2, 80);
    s += text((sx + x1) / 2, 106, 'the gap', { size: 12, fill: ASK, weight: 700 });
    return { svg: svg(114, s), line: `Line the ${u(p.big, p.unit)} up against the ${p.small}. The gap is how many more: ${p.small} + ? = ${p.big}.` };
  },
  // a road with a marker for each hour (or day), and the town at the end
  road(p) {
    const x0 = 16, x1 = W - 34, y = 76, unit = p.step;
    let s = `<path d="M${x0} ${y}H${x1}" stroke="${SOFT}" stroke-width="10" stroke-linecap="round"/><path d="M${x0} ${y}H${x1}" stroke="${FILL}" stroke-width="2" stroke-dasharray="6 6"/>`;
    // the town
    s += `<path d="M${x1 + 4} ${y - 4}h20v-14l-10-8-10 8z" fill="${FILL2}" stroke="${INK}" stroke-width="1.2"/>`;
    let line;
    if (p.steps) {
      const n = p.steps, sw = (x1 - x0) / n;
      for (let i = 0; i <= n; i++) s += `<path d="M${(x0 + i * sw).toFixed(1)} ${y - 9}v18" stroke="${INK}" stroke-width="1.6"/>` + (i < n ? text(x0 + (i + 0.5) * sw, y + 26, `${unit[0]} ${i + 1}`, { size: n > 6 ? 9 : 11, fill: SOFT }) : '');
      for (let i = 0; i < n; i++) s += p.speed != null ? text(x0 + (i + 0.5) * sw, y - 14, String(p.speed), { size: n > 6 ? 11 : 13 }) : q(x0 + (i + 0.5) * sw, y - 13, n > 6 ? 14 : 17);
      s += brace(x0, x1, 36, p.total != null ? `${p.total} miles` : '', { ask: p.total == null });
      line = p.speed != null
        ? `${n} ${unit[1]}, ${p.speed} miles every ${unit[0]}: add up the stretches of road.`
        : `${p.total} miles cut into ${n} equal ${unit[0]} stretches. How long is each stretch?`;
    } else {
      // the time: one stretch is known, how many fit?
      const sw = (x1 - x0) * Math.min(0.32, p.speed / p.total);
      s += `<path d="M${x0} ${y - 9}v18M${(x0 + sw).toFixed(1)} ${y - 9}v18" stroke="${INK}" stroke-width="1.6"/>`;
      s += text(x0 + sw / 2, y - 14, `${p.speed} mi`, { size: 12 }) + text(x0 + sw / 2, y + 26, `1 ${unit[0]}`, { size: 11, fill: SOFT });
      s += text((x0 + sw + x1) / 2, y + 26, `${p.speed} more each ${unit[0]}…`, { size: 11, fill: SOFT });
      s += brace(x0, x1, 36, `${p.total} miles`);
      s += text(W / 2, y + 48, `how many ${unit[0]}s of ${p.speed} fit in ${p.total}? `, { size: 13, fill: ASK, weight: 700 });
      line = `Each ${unit[0]} covers ${p.speed} miles. Count the ${unit[0]}s it takes to cover ${p.total}.`;
    }
    return { svg: svg(p.steps ? 114 : 132, s), line };
  },
  // a recipe as a little table: batches across, and the same "times" on both rows
  ratio(p) {
    const cx = [60, 276];
    let s = `<defs><marker id="bmp-ar2" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="${BRASS}"/></marker></defs>`;
    s += text(cx[0] - 34, 14, p.make[1], { size: 12, anchor: 'start', fill: SOFT }) + text(cx[0] - 34, 76, p.unit[1], { size: 12, anchor: 'start', fill: SOFT });
    s += bar(cx[0] - 34, cx[0] + 34, 20, 30, String(p.base)) + bar(cx[1] - 34, cx[1] + 34, 20, 30, String(p.want), { fill: FILL2 });
    s += bar(cx[0] - 34, cx[0] + 34, 82, 30, String(p.per)) + bar(cx[1] - 34, cx[1] + 34, 82, 30, null, { ask: true, fill: FILL2 });
    for (const y of [35, 97]) s += `<path d="M${cx[0] + 40} ${y}H${cx[1] - 42}" stroke="${BRASS}" stroke-width="2" marker-end="url(#bmp-ar2)"/>` + text(W / 2, y - 6, `× ${p.k}`, { size: 14, fill: BRASS, weight: 800 });
    return { svg: svg(120, s), line: `${p.want} ${p.make[1]} is ${p.k} times ${p.base}, so everything in the recipe goes ${p.k} times over, not just a few more.` };
  },
  // a price cut into equal parts; the percent's share shaded (off the price, or added on as tax)
  percent(p) {
    const n = p.parts, x0 = 10, x1 = p.mode === 'tax' ? W - 10 - (W - 20) / (n + 1) : W - 10, pw = (x1 - x0) / n;
    const share = Math.round(n * p.pct / 100);
    let s = brace(x0, x1, 26, `$${p.whole}`);
    for (let i = 0; i < n; i++) {
      const off = p.mode === 'off' && i >= n - share;
      s += `<rect x="${(x0 + i * pw).toFixed(1)}" y="32" width="${(pw - 1.5).toFixed(1)}" height="30" rx="2" fill="${off ? '#f3c9b4' : FILL}" stroke="${off ? ASK : INK}" stroke-width="1.2"/>`;
    }
    if (p.mode === 'tax') s += `<rect x="${(x1 + 2).toFixed(1)}" y="32" width="${(pw * share - 2).toFixed(1)}" height="30" rx="2" fill="#cfe0b5" stroke="${GREEN}" stroke-width="1.2"/>`;
    const tag = p.mode === 'off' ? `${p.pct}% off = ${share} of the ${n} parts` : `${p.pct}% tax = ${share} more part${share > 1 ? 's' : ''} the size of these`;
    s += text(W / 2, 84, tag, { size: 12, fill: p.mode === 'off' ? ASK : GREEN, weight: 700 });
    s += text(W / 2, 106, p.mode === 'off' ? 'what is paid = the plain parts: ?' : 'what is paid = the whole bar and the tax part: ?', { size: 13, fill: ASK, weight: 800 });
    return { svg: svg(116, s), line: `$${p.whole} cut into ${n} equal parts of $${p.whole / n}. ${p.mode === 'off' ? `${p.pct}% off takes ${share} of them away.` : `${p.pct}% tax adds ${share} more.`}` };
  },
  // two steps: the groups first, then the bar for the second step
  twostep(p) {
    const money = p.unit === 'money', v = (n) => val(n, p.unit, p.cents);
    const a = p.groups, b = p.each, bw = (W - 20) / a;
    let s = text(10, 14, 'Step 1', { size: 12, anchor: 'start', fill: BRASS, weight: 800 });
    for (let i = 0; i < a; i++) s += bar(10 + i * bw, 10 + (i + 1) * bw - 2, 20, 26, money ? cash(b, p.cents) : String(b));
    s += text(W - 12, 62, `${a} × ${money ? cash(b, p.cents) : b} = ?`, { size: 13, anchor: 'end', fill: ASK, weight: 800 });
    s += text(10, 80, 'Step 2', { size: 12, anchor: 'start', fill: BRASS, weight: 800 });
    if (p.then === 'minus') {
      const frac = 0.38;
      s += bar(10, W - 10, 86, 26, 'all of it: step 1', { fill: FILL2 });
      s += bar(10, 10 + (W - 20) * frac - 2, 118, 26, `has ${v(p.other)}`) + bar(10 + (W - 20) * frac, W - 10, 118, 26, null, { ask: true });
      return { svg: svg(150, s), line: `First work out how much is needed in all. Then take off the ${v(p.other)} already there.` };
    }
    s += bar(10, W - 10, 86, 26, `paid ${v(p.other)}`, { fill: FILL2 });
    s += bar(10, 10 + (W - 20) * 0.6 - 2, 118, 26, 'the bill: step 1') + bar(10 + (W - 20) * 0.6, W - 10, 118, 26, null, { ask: true });
    s += text(W - 12, 160, 'change', { size: 12, anchor: 'end', fill: SOFT });
    return { svg: svg(166, s), line: `First the bill: ${a} at ${v(b)} each. Then the change is what's left of the ${v(p.other)}.` };
  },
  // a story told backwards: a boxes of x and the extra number make the total
  equation(p) {
    const a = p.a, b = p.b, c = p.c, x0 = 10, x1 = W - 10;
    const bw = b > 0 ? 60 : 0, xw = (x1 - x0 - bw) / a;
    let s = b > 0 ? brace(x0, x1, 26, `${c}`) : '';
    for (let i = 0; i < a; i++) s += bar(x0 + i * xw, x0 + (i + 1) * xw - 2, 30, 32, 'x');
    if (b > 0) s += bar(x1 - bw, x1, 30, 32, String(b), { fill: FILL2 });
    else {
      // taking away: the last part of the x boxes crossed off, and what is left is the total
      const cut = Math.min(xw * 0.9, 50);
      s += `<rect x="${(x1 - cut).toFixed(1)}" y="30" width="${(cut - 2).toFixed(1)}" height="32" fill="url(#bmp-hatch)" stroke="${ASK}" stroke-width="1.2"/>`;
      s += text(x1 - cut / 2, 80, `− ${-b}`, { size: 13, fill: ASK, weight: 800 });
      s += brace(x0, x1 - cut - 2, 94, `${c} left`, { up: false });
      s = `<defs><pattern id="bmp-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V6" stroke="${ASK}" stroke-width="1.5"/></pattern></defs>` + s;
    }
    return { svg: svg(b > 0 ? 70 : 128, s), line: b > 0 ? `${a} boxes of x and the ${b} together make ${c}. Which equation says just that?` : `${a} boxes of x, take away ${-b}, leave ${c}. Which equation says just that?` };
  },
};

// one of the things to count, drawn at (x, y) about 26 px across (apples, eggs, carrots, loaves, cans, horseshoes)
const THING = {
  apple: (x, y) => `<circle cx="${x}" cy="${y + 2}" r="11" fill="#c8483a" stroke="${INK}" stroke-width="1.2"/><path d="M${x} ${y - 9}q1 -5 4 -7" stroke="${INK}" stroke-width="1.6" fill="none"/><path d="M${x + 2} ${y - 11}q6 -3 9 1q-5 3 -9 -1z" fill="${GREEN}"/>`,
  egg: (x, y) => `<ellipse cx="${x}" cy="${y + 1}" rx="9" ry="12" fill="#f6efe0" stroke="${INK}" stroke-width="1.2"/>`,
  carrot: (x, y) => `<path d="M${x - 6} ${y - 6}L${x + 6} ${y - 6}L${x} ${y + 14}Z" fill="#e0822f" stroke="${INK}" stroke-width="1.1"/><path d="M${x} ${y - 6}l-5 -8M${x} ${y - 6}l0 -9M${x} ${y - 6}l5 -8" stroke="${GREEN}" stroke-width="2"/>`,
  loaf: (x, y) => `<path d="M${x - 13} ${y + 8}v-6q0 -10 13 -10q13 0 13 10v6z" fill="#c98a45" stroke="${INK}" stroke-width="1.2"/><path d="M${x - 6} ${y - 4}l3 5M${x} ${y - 6}l3 5M${x + 6} ${y - 4}l3 5" stroke="#8a5a26" stroke-width="1.4"/>`,
  can: (x, y) => `<rect x="${x - 9}" y="${y - 11}" width="18" height="24" rx="3" fill="#b9b4a8" stroke="${INK}" stroke-width="1.2"/><rect x="${x - 9}" y="${y - 4}" width="18" height="10" fill="#b5523a"/>`,
  shoe: (x, y) => `<path d="M${x - 9} ${y + 11}V${y}a9 9 0 0 1 18 0V${y + 11}" fill="none" stroke="#6b6358" stroke-width="5" stroke-linecap="round"/>`,
};
// a row of n things from x0, spaced dx, at y; the ones from `cross` on crossed out (sold, eaten)
function things(shape, n, x0, y, dx, cross = Infinity) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + i * dx;
    s += `<g${i >= cross ? ' opacity="0.45"' : ''}>${(THING[shape] || THING.egg)(x.toFixed(1), y)}</g>`;
    if (i >= cross) s += `<path d="M${(x - 11).toFixed(1)} ${y - 11}l22 22M${(x + 11).toFixed(1)} ${y - 11}l-22 22" stroke="${ASK}" stroke-width="2.4" stroke-linecap="round"/>`;
  }
  return s;
}
Object.assign(DRAW, {
  // the youngest riders' stories: the things themselves (2 apples and 1 more; 7 eggs with 3 crossed out; 3 baskets of 2)
  things(p) {
    const U = p.unit;
    if (p.mode === 'more') {
      const n = p.a + p.b, dx = Math.min(30, (W - 60) / Math.max(1, n));
      let s = things(p.shape, p.a, 20, 34, dx);
      const px = 20 + p.a * dx + 2;
      s += text(px, 40, '+', { size: 22, fill: BRASS, weight: 800 });
      s += things(p.shape, p.b, px + 22, 34, dx);
      s += text(W / 2, 84, `${u(p.a, U)} and ${p.b} more: how many in all?`, { size: 14, fill: ASK, weight: 800 });
      return { svg: svg(96, s), line: `Count them all: the ${p.a} first, then keep counting the ${p.b} new ${p.b === 1 ? 'one' : 'ones'}.` };
    }
    if (p.mode === 'left') {
      const dx = Math.min(30, (W - 40) / p.a);
      let s = things(p.shape, p.a, 22, 34, dx, p.a - p.b);
      s += text(W / 2, 84, `${p.b} crossed out: how many are left?`, { size: 14, fill: ASK, weight: 800 });
      return { svg: svg(96, s), line: `${u(p.a, U)} at first. Cover the ${p.b} crossed out and count the ones still here.` };
    }
    // baskets
    const bw = (W - 20) / p.g;
    let s = '';
    for (let i = 0; i < p.g; i++) {
      const x0 = 10 + i * bw;
      // (the things first, sitting down in the basket; then the basket's front over their lower half)
      s += things(p.shape, p.e, x0 + bw / 2 - (p.e - 1) * 11, 36, 22);
      s += `<path d="M${(x0 + 6).toFixed(1)} 40h${(bw - 14).toFixed(1)}l-8 32h${(-(bw - 30)).toFixed(1)}z" fill="${FILL2}" stroke="${INK}" stroke-width="1.3"/>`;
    }
    s += text(W / 2, 92, `${p.g} baskets of ${p.e}: how many in all?`, { size: 14, fill: ASK, weight: 800 });
    return { svg: svg(102, s), line: `Count every one in every basket: ${p.g} baskets, ${p.e} in each.` };
  },
  // a big order: a few of the lots drawn, the rest dashed, and the sum to work out on paper (never its answer)
  lots(p) {
    const n = p.lots, a = p.each, shown = Math.min(3, n), x0 = 10, x1 = W - 10, bw = (x1 - x0) / (shown + (n > shown ? 2 : 0));
    let s = '';
    for (let i = 0; i < shown; i++) s += bar(x0 + i * bw, x0 + (i + 1) * bw - 3, 34, 30, String(a));
    if (n > shown) s += `<rect x="${(x0 + shown * bw).toFixed(1)}" y="34" width="${(2 * bw - 3).toFixed(1)}" height="30" rx="3" fill="none" stroke="${INK}" stroke-width="1.4" stroke-dasharray="4 3"/>` + text(x0 + (shown + 1) * bw, 54, `${n - shown} more…`, { size: 12, fill: SOFT });
    s += brace(x0, x1, 28, '', { ask: true });
    s += text(W / 2, 90, `${n} ${p.count} of ${a}: ${a} × ${n} = ?`, { size: 14, fill: ASK, weight: 800 });
    return { svg: svg(100, s), line: `${n} ${p.count}, ${a} in each: that's ${a} × ${n}. Work it out on paper.` };
  },
});

export const PIC_TITLES = {
  things: 'Count them', lots: 'Lots of the same',
  groups: 'Equal groups', share: 'Sharing it out', parts: 'The whole and its parts', compare: 'Side by side', road: 'The road there',
  ratio: 'Scaling the recipe', percent: 'Cut into equal parts', twostep: 'Two steps', equation: 'The story as boxes',
};

export function picture(pic) {
  const d = DRAW[pic && pic.kind];
  if (!d) return { svg: '', title: '', line: '' };
  const { svg: s, line } = d(pic);
  return { svg: s, title: PIC_TITLES[pic.kind] || '', line };
}
