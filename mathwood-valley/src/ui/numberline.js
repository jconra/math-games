// numberline.js: a number line that shows how positive and negative numbers add up.
//
//   const nl = showNumberLine(container, { start: -10, change: 18 });   // -> { el, remove(), done }
//   nl.remove();
//
// It draws a plain number line with zero clearly marked, a dot on the start, and the hop as an arrow curving
// over the line. A hop that crosses zero is drawn in two parts, "+10 to zero" and "+8 more", because that is
// the easy way to work it out: get to zero first, then go the rest of the way. The landing dot shows the
// answer. With animate on (the default) a dot rides along the hop in about 1.5 seconds.
//
// Options (only start and change are needed):
//   start, change     where the hop starts and how far it goes: + goes up the line (right), − goes down (left)
//   result            where it lands; always start + change (passing it is fine, it is only checked)
//   animate = true    draw the hop with a dot riding along it; false draws it finished straight away
//   reason            one plain line under the picture ("You went down 18. Adding 18 goes UP the line...")
//   reveal = true     false keeps the answer hidden: a "?" where it lands and "+? more" on the second part,
//                     for a kid who is stuck but hasn't answered yet
//   op, term          the problem as written. For 5 − (−3) that is op '−', term −3. Taking away a negative,
//                     or adding one, first shows the turn-around: "Taking away −3 is the same as adding 3".
//                     A card's `parts` ({ start, change, op, term }) can be passed straight in.
//   picked            the kid's wrong answer, marked on the line with a cross ("your pick"). When it is too close
//                     to the landing dot or the start to draw apart (one off on a long line, or the same number
//                     as the start), it is named in the caption instead: "lands here (you picked 12)".
//   theme = 'auto'    'dark' over the game, 'light' on paper (the lock box). 'auto' looks at the colour behind.
//   size              'full'; 'compact', a shorter one for a short window (chosen by itself when no size is
//                     given and the window is under 500 px tall); 'inline', a tiny one for the lock box's sums
//   width             drawing width in pixels (default: the container's width)
//   backing           a dark smoky panel behind it (default: on for the full dark one, off otherwise)
//
// watchHesitation({ after = 8000, onShow }) -> { answered(), cancel(), restart() }
//   Calls onShow once if `after` ms pass before answered() or cancel() is called: the "still thinking?"
//   timer the game uses to bring up the number line (or the times chart) for a kid who is stuck.
//
// layoutNumberLine(options) works out the drawing without touching the page (the tests use it).

const MINUS = '−';   // the real minus sign (U+2212), wider than a hyphen

// A value as it is printed: −8, 0, 18.
export const numText = (n) => (n < 0 ? MINUS : '') + Math.abs(n);
// A change as it is printed: +18, −5.
export const signedText = (n) => (n < 0 ? MINUS : '+') + Math.abs(n);

// How long the pieces of the animation take, in ms.
const HOP_MS = 1150;         // the whole hop, split between its parts by length
const TURN_HOLD = 500;       // the turn-around: the arrow points the "obvious" way for this long,
const TURN_SWING = 600;      // swings round over this long,
const TURN_MS = 1500;        // and the hop starts after this long (the turned arrow holds in between)
const POP_MS = 260;          // the landing dot growing in
const FADE_MS = 220;         // labels fading in

// Sizes (in pixels at 1:1) for the versions.
//   crowd: a pick closer than this to the landing dot or the start is named in the caption instead of drawn
const SIZES = {
  full: {
    side: 40, top: 12, lineW: 4, overhang: 22, endArrow: 11,
    tickMinor: 6, tickMajor: 10, zeroTick: 20,
    tickFont: 19, keyFont: 28, arcFont: 21, capFont: 14, turnFont: 20,
    labelY: 36, capY: 64, bottom: 74, turnRow: 40,
    arcMin: 34, arcMax: 96, arcK: 0.42, dotR: 9, landR: 11, arrowLen: 13, arrowHalf: 7.5,
    minorGap: 9, labelGap: 14, keyGap: 10, capGap: 18, pickR: 8, crowd: 24, turnY: 22, turnX: 42, turnScale: 1.3,
  },
  compact: {
    side: 26, top: 8, lineW: 3.5, overhang: 16, endArrow: 9,
    tickMinor: 5, tickMajor: 8, zeroTick: 16,
    tickFont: 15, keyFont: 22, arcFont: 17, capFont: 12, turnFont: 16,
    labelY: 29, capY: 51, bottom: 58, turnRow: 28,
    arcMin: 26, arcMax: 58, arcK: 0.34, dotR: 7.5, landR: 9, arrowLen: 11, arrowHalf: 6.5,
    minorGap: 8, labelGap: 12, keyGap: 8, capGap: 15, pickR: 6.5, crowd: 20, turnY: 20, turnX: 34, turnScale: 1.05,
  },
  inline: {
    side: 12, top: 3, lineW: 2.5, overhang: 8, endArrow: 5,
    tickMinor: 3, tickMajor: 5, zeroTick: 10,
    tickFont: 0, keyFont: 14, arcFont: 12.5, capFont: 0, turnFont: 0,
    labelY: 18, capY: 0, bottom: 23, turnRow: 0,
    arcMin: 9, arcMax: 17, arcK: 0.3, dotR: 4, landR: 5, arrowLen: 6, arrowHalf: 4,
    minorGap: 4, labelGap: 8, keyGap: 6, capGap: 0, pickR: 4, crowd: 0, turnY: 0, turnX: 0, turnScale: 0,
  },
};

const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

// Bitter's character widths, in em (measured in the browser by rigs/neg_f1_glyphs.cjs, within 1% of the real
// text): `book` for the plain numbers and the small captions (weights 500-600), `bold` for the key numbers, the
// hop's words and the answer (700-800). Anything not listed counts as 0.6 (0.68 for a capital).
const GLYPHS = {
  book: { 0: 0.64, 1: 0.42, 2: 0.56, 3: 0.55, 4: 0.6, 5: 0.54, 6: 0.59, 7: 0.53, 8: 0.58, 9: 0.59, '−': 0.55, '+': 0.56, '?': 0.43, '(': 0.31, ')': 0.31, ' ': 0.19, ',': 0.25, '.': 0.24, ':': 0.23, a: 0.56, c: 0.51, d: 0.6, e: 0.55, g: 0.56, h: 0.63, i: 0.31, k: 0.58, l: 0.3, m: 0.95, n: 0.64, o: 0.58, p: 0.6, r: 0.45, s: 0.48, t: 0.38, u: 0.63, v: 0.52, w: 0.8, y: 0.52, z: 0.5, '←': 0.84, '→': 0.84 },
  bold: { 0: 0.64, 1: 0.44, 2: 0.57, 3: 0.57, 4: 0.62, 5: 0.55, 6: 0.59, 7: 0.56, 8: 0.59, 9: 0.59, '−': 0.53, '+': 0.55, '?': 0.45, '(': 0.32, ')': 0.32, ' ': 0.18, ',': 0.27, '.': 0.26, ':': 0.24, a: 0.57, c: 0.51, d: 0.61, e: 0.55, g: 0.58, h: 0.64, i: 0.33, k: 0.6, l: 0.32, m: 0.95, n: 0.65, o: 0.58, p: 0.62, r: 0.48, s: 0.51, t: 0.41, u: 0.64, v: 0.53, w: 0.83, y: 0.54, z: 0.52, '←': 0.84, '→': 0.84 },
};
const CAP_SPACING = 0.04;   // the small captions have this much letter spacing (em), as in numberline.css

// How wide a line of text is, in pixels. kind: 'tick' (plain numbers), 'cap' (small captions), or 'bold'.
export function textWidth(text, font, kind = 'bold') {
  const table = kind === 'bold' ? GLYPHS.bold : GLYPHS.book;
  let w = 0, n = 0;
  for (const ch of String(text)) { w += table[ch] ?? (/[A-Z]/.test(ch) ? 0.68 : 0.6); n++; }
  return (w + (kind === 'cap' ? CAP_SPACING * n : 0)) * font;
}

// Spreads labels along one row so none overlap: each is { x, w } (centre and width), sorted by x. Labels keep as
// close to their spot as they can; one marked `pin` (zero) stays on its spot and the others move out of its way.
// Returns false if they can't all fit between lo and hi.
function spread(items, gap, lo, hi) {
  items.sort((a, b) => a.x - b.x);
  const fits = () => items.every((it, i) => !i || it.x - items[i - 1].x >= (it.w + items[i - 1].w) / 2 + gap - 1);
  for (let pass = 0; pass < 12; pass++) {
    let moved = false;
    for (let i = 1; i < items.length; i++) {
      const a = items[i - 1], b = items[i];
      const need = (a.w + b.w) / 2 + gap - (b.x - a.x);
      if (need <= 0.5) continue;
      if (a.pin && !b.pin) b.x += need;
      else if (b.pin && !a.pin) a.x -= need;
      else { a.x -= need / 2; b.x += need / 2; }
      moved = true;
    }
    for (const it of items) {
      if (it.x - it.w / 2 < lo) { it.x = lo + it.w / 2; moved = true; }
      if (it.x + it.w / 2 > hi) { it.x = hi - it.w / 2; moved = true; }
    }
    if (!moved) return true;
  }
  if (fits()) return true;
  // no room around a pinned label: let it move too
  if (items.some((it) => it.pin)) { for (const it of items) it.pin = false; return spread(items, gap, lo, hi); }
  return false;
}

const overlaps = (a, b, gap) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + gap;

// The hop's curve, as points (y up = minus, measured from the line), for checking what it passes through.
// (about one point every 6 px along a long curve, so a corner of a label box is never stepped over)
function arcPoints(p, n = Math.max(32, Math.ceil(Math.abs(p.x1 - p.x0) / 6))) {
  const y0 = p.yFoot, y3 = p.yEnd, k = p.h / 0.75, out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const xx = u * u * u * p.x0 + 3 * u * u * t * p.x0 + 3 * u * t * t * p.x1 + t * t * t * p.x1;
    const yy = u * u * u * y0 + 3 * u * u * t * (y0 - k) + 3 * u * t * t * (y0 - k) + t * t * t * y3;
    out.push([xx, yy]);
  }
  return out;
}
// A label's box: { l, r, t, b } around its text (baseline y, font size), with a little room.
const boxOf = (lab, font, pad = 3) => ({ l: lab.x - lab.w / 2 - pad, r: lab.x + lab.w / 2 + pad, t: lab.y - font * 0.78 - pad, b: lab.y + font * 0.2 + pad });
const boxHits = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
const pointsIn = (box, pts) => pts.some(([px, py]) => px > box.l && px < box.r && py > box.t && py < box.b);

// ---- the drawing, worked out as plain numbers ----------------------------------------------------------------

export function layoutNumberLine(o = {}) {
  const size = o.size === 'inline' ? 'inline' : o.size === 'compact' ? 'compact' : 'full';
  const S = SIZES[size];
  const tiny = size === 'inline';
  const start = Math.round(Number(o.start) || 0);
  const change = Math.round(Number(o.change) || 0);
  const end = start + change;
  const reveal = o.reveal !== false;
  const picked = typeof o.picked === 'number' && Number.isFinite(o.picked) && o.picked !== end ? Math.round(o.picked) : null;
  const W = Math.max(tiny ? 120 : 300, Math.round(Number(o.width) || (tiny ? 240 : 760)));
  const left = S.side, right = W - S.side;
  const crosses = start !== 0 && end !== 0 && Math.sign(start) !== Math.sign(end);

  // The turn-around: taking away a negative goes up, adding a negative goes down.
  const op = o.op === '-' || o.op === MINUS ? '−' : o.op === '+' ? '+' : null;
  const term = typeof o.term === 'number' ? o.term : null;
  let turn = null;
  if (op && term != null && term < 0) {
    turn = op === '−'
      ? { text: `Taking away ${numText(term)} is the same as adding ${-term}`, from: -1, to: 1 }
      : { text: `Adding ${numText(term)} is the same as taking away ${-term}`, from: 1, to: -1 };
  }

  // The stretch of the line to show: the start, the landing, zero (always) and the kid's pick, with a little
  // room either side, rounded out to the label spacing.
  const keys = [start, end, 0];
  if (picked != null) keys.push(picked);
  const lo0 = Math.min(...keys), hi0 = Math.max(...keys);
  let lo = lo0, hi = hi0, minor = 1, major = 1, ppu = 1;
  const keyLabelW = Math.max(textWidth(numText(lo0), S.keyFont), textWidth(numText(hi0), S.keyFont)) + (tiny ? 4 : 14);
  for (let pass = 0; pass < 4; pass++) {
    ppu = (right - left) / Math.max(1, hi - lo);
    minor = STEPS.find((s) => s * ppu >= S.minorGap) || STEPS[STEPS.length - 1];
    const labelFont = S.tickFont || S.keyFont;
    const lw = Math.max(textWidth(numText(lo), labelFont, 'tick'), textWidth(numText(hi), labelFont, 'tick')) + S.labelGap;
    major = STEPS.find((s) => s % minor === 0 && s * ppu >= lw) || STEPS[STEPS.length - 1];
    if (tiny) major = STEPS.find((s) => s % minor === 0 && s * ppu >= Math.max(lw, 22)) || major;
    const pad = Math.max(1, (hi0 - lo0) * 0.07, (keyLabelW / 2 + 4) / ppu);
    lo = Math.floor((lo0 - pad) / major) * major;
    hi = Math.ceil((hi0 + pad) / major) * major;
  }
  ppu = (right - left) / Math.max(1, hi - lo);
  const x = (v) => left + (v - lo) * ppu;
  const startX = x(start), endX = x(end);

  // The kid's pick: a cross on the line, unless it is too close to the landing dot or the start (or is zero,
  // where the hop's arrowheads meet) to be seen there. Then the caption under that spot names it instead.
  let crowd = null;
  if (picked != null && !tiny) {
    const px = x(picked);
    if (picked === 0 && start !== 0) crowd = 'zero';
    else if (Math.abs(px - endX) < S.crowd) crowd = 'end';
    else if (Math.abs(px - startX) < S.crowd) crowd = 'start';
  }

  // ----- the rows below the line: tick labels, the key numbers, small captions
  const keyLabels = [];
  const addKey = (v, text, kind, prio, w, extra) => keyLabels.push({ v, x: x(v), at: x(v), w, text, kind, prio, ...extra });
  // the landing number sits in a pill at least a little wider than it is tall
  const endText = reveal ? numText(end) : '?';
  addKey(end, endText, 'end', 0, Math.max(textWidth(endText, S.keyFont) + (tiny ? 6 : 14), S.keyFont * 1.55));
  if (start !== end) addKey(start, numText(start), 'start', 1, textWidth(numText(start), S.keyFont));
  // zero keeps its spot under the zero mark; the others move out of its way
  if (start !== 0 && end !== 0) addKey(0, '0', 'zero', 2, textWidth('0', S.keyFont), { pin: true });
  if (picked != null && !crowd && picked !== start && picked !== 0) addKey(picked, numText(picked), 'pick', 3, textWidth(numText(picked), S.keyFont) + (tiny ? 0 : 14));
  spread(keyLabels, S.keyGap, 2, W - 2);
  // a label pushed so far that its spot is no longer above it gets a thin line back to it
  for (const k of keyLabels) k.lead = Math.abs(k.x - k.at) > k.w / 2 - 3;

  const ticks = [];
  const first = Math.ceil(lo / minor) * minor;
  for (let v = first; v <= hi + 1e-9; v += minor) {
    const isMajor = Math.abs(v % major) < 1e-9;
    const t = { v, x: x(v), major: isMajor, zero: v === 0, neg: v < 0, label: null, late: false };
    if (isMajor && S.tickFont) {
      const lab = { x: t.x, w: textWidth(numText(v), S.tickFont, 'tick') };
      // a key number at or near this spot is printed bigger, so the plain label steps aside. One that only gives
      // way to the landing number stays up while the hop runs and fades as the answer comes in (`late`), so the
      // row of numbers has no gap giving away where the hop is going.
      const by = keyLabels.filter((k) => k.v === v || overlaps(lab, k, S.labelGap * 0.6));
      if (!by.length) t.label = numText(v);
      else if (by.every((k) => k.kind === 'end')) { t.label = numText(v); t.late = true; }
    }
    ticks.push(t);
  }

  const caps = [];
  if (S.capFont) {
    const youPicked = picked != null ? ` (you picked ${numText(picked)})` : '';
    const capFor = (k, parts) => {
      const text = parts.map((p) => p.text).join('');
      caps.push({ x: k.x, at: k.at, w: textWidth(text, S.capFont, 'cap'), text, kind: k.kind, parts });
    };
    for (const k of keyLabels) {
      if (k.kind === 'start') capFor(k, [{ text: 'start', kind: 'start' }, ...(crowd === 'start' ? [{ text: picked === start ? ' (your pick)' : youPicked, kind: 'pick' }] : [])]);
      else if (k.kind === 'end') capFor(k, [{ text: reveal ? 'lands here' : 'lands where?', kind: 'end' }, ...(crowd === 'end' ? [{ text: youPicked, kind: 'pick' }] : [])]);
      else if (k.kind === 'zero' && crowd === 'zero') capFor({ ...k, kind: 'pick' }, [{ text: 'your pick', kind: 'pick' }]);
      else if (k.kind === 'pick') capFor(k, [{ text: 'your pick', kind: 'pick' }]);
    }
    spread(caps, S.capGap, 2, W - 2);
    // "negative" and "positive" under each half of the line, where there is room
    const sides = [];
    if (lo < 0) sides.push({ text: '← negative', a: left, b: Math.min(right, x(0) - 14), kind: 'neg' });
    if (hi > 0) sides.push({ text: 'positive →', a: Math.max(left, x(0) + 14), b: right, kind: 'pos' });
    for (const s of sides) {
      const w = textWidth(s.text, S.capFont, 'cap');
      if (s.b - s.a < w + 8) continue;
      // try the middle of the half first, then nearer its outer end, then nearer zero
      const tries = [0.5, s.kind === 'neg' ? 0.2 : 0.8, s.kind === 'neg' ? 0.05 : 0.95, s.kind === 'neg' ? 0.8 : 0.2];
      for (const f of tries) {
        const c = { x: Math.max(s.a + w / 2, Math.min(s.b - w / 2, s.a + (s.b - s.a) * f)), w };
        if (!caps.some((k) => overlaps(c, k, S.capGap + 6))) { caps.push({ ...c, text: s.text, kind: 'side-' + s.kind, parts: [{ text: s.text, kind: 'side-' + s.kind }] }); break; }
      }
    }
  }

  // ----- the hop: one arc, or two when it crosses zero
  const parts = [];
  if (change !== 0) {
    if (crosses) {
      // the tiny version has room only for the numbers: "+10", "+8"
      const more = tiny ? '' : ' more';
      parts.push({ from: start, to: 0, label: `${signedText(-start)}${tiny ? '' : ' to zero'}` });
      parts.push({ from: 0, to: end, label: reveal ? `${signedText(end)}${more}` : `${end < 0 ? MINUS : '+'}?${more}` });
    } else {
      // "+6 to zero" only when the answer is showing: with the answer hidden it would give it away
      parts.push({ from: start, to: end, label: end === 0 && reveal && !tiny ? `${signedText(change)} to zero` : signedText(change) });
    }
  }
  const yFoot = -(S.dotR + 2);                    // arcs start just above the line (relative to the line, y up = minus)
  let lenTotal = 0;
  for (const p of parts) {
    p.x0 = x(p.from); p.x1 = x(p.to); p.yFoot = yFoot;
    const span = Math.abs(p.x1 - p.x0);
    // a short hop gets a low curve (not a tall narrow loop) and a smaller arrowhead
    p.h = Math.min(S.arcMax, Math.max(Math.min(S.arcMin, span * 0.8), span * S.arcK));
    p.arrow = Math.max(0.45, Math.min(1, span / (S.arrowLen * 2.6)));
    p.yEnd = yFoot - S.arrowLen * p.arrow + 2;
    p.pts = arcPoints(p);
    p.top = yFoot - p.h;                          // the curve's highest point
    p.len = span + p.h * 1.2;                     // a rough length of the curve, for sharing out the hop's time
    lenTotal += p.len;
  }
  // ----- the turn-around mark: beside the start dot, on the side away from the hop, so it never sits on a curve
  let turnAt = null;
  if (turn && !tiny) {
    const dir = Math.sign(change) || 1;
    turnAt = { x: Math.max(S.turnX * 0.75, Math.min(W - S.turnX * 0.75, startX - dir * S.turnX)), y: -S.turnY, dir };
    const a = turnAt.x - dir * 10 * S.turnScale, c = turnAt.x + dir * 22 * S.turnScale;
    turnAt.box = { l: Math.min(a, c), r: Math.max(a, c), t: turnAt.y - 22 * S.turnScale, b: turnAt.y + 3 };
  }

  const font = S.arcFont, lift = tiny ? 4 : 10;
  const inside = (w, cx) => Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, cx));
  if (tiny) {
    // the tiny version: each part's number over its curve, if it fits
    for (const p of parts) {
      const w = textWidth(p.label, font);
      p.lab = { x: inside(w, (p.x0 + p.x1) / 2), y: p.top - lift, w };
      p.showLabel = Math.abs(p.x1 - p.x0) >= w * 0.9 || parts.length === 1;
    }
    if (parts.length === 2 && overlaps(parts[0].lab, parts[1].lab, 8)) spread([parts[0].lab, parts[1].lab], 8, 4, W - 4);
  } else {
    // The taller part's words go over its own curve. The shorter part's words go where no curve and no other
    // words cross them: over their own curve, or slid to the side away from the other part, or (failing that)
    // lifted above everything with a thin line down to their curve.
    const placed = [];
    // the hop's words keep clear of both curves and arrowheads, of the turn-around mark, and well apart from each other (so
    // "+10 to zero" and "+8 more" never read as one phrase)
    const clear = (lab) => {
      const box = boxOf(lab, font, 2);
      if (box.l < 2 || box.r > W - 2) return false;
      if (parts.some((q) => pointsIn(box, q.pts))) return false;
      if (turnAt && boxHits(box, turnAt.box)) return false;
      if (parts.some((q) => boxHits(box, { l: q.x1 - S.arrowHalf * q.arrow - 1, r: q.x1 + S.arrowHalf * q.arrow + 1, t: yFoot - S.arrowLen * q.arrow, b: yFoot + 2 }))) return false;   // the arrowheads
      return !placed.some((q) => boxHits(boxOf(lab, font, 8), boxOf(q.lab, font, 8)));
    };
    for (const p of [...parts].sort((a, b) => b.h - a.h)) {
      const w = textWidth(p.label, font), cx = (p.x0 + p.x1) / 2;
      const other = parts.find((q) => q !== p);
      const away = other ? Math.sign(cx - (other.x0 + other.x1) / 2) || 1 : 1;
      const tries = [{ x: inside(w, cx), y: p.top - lift, w }];
      // (sliding toward the other part would tuck the words under its curve, where they read as its own)
      for (const f of [0.3, 0.6, 0.9, 1.2]) tries.push({ x: inside(w, cx + away * f * w), y: p.top - lift, w });
      let lab = tries.find(clear);
      if (!lab) {
        const roof = Math.min(...parts.map((q) => q.top), ...placed.map((q) => q.lab.y - font * 0.78));
        lab = { x: inside(w, cx + away * (w / 2 + 6)), y: roof - 10 - font * 0.2, w, lead: true };
      }
      p.lab = lab;
      p.showLabel = true;
      placed.push(p);
    }
  }
  for (const p of parts) p.share = lenTotal ? p.len / lenTotal : 1;

  // ----- vertical: everything was placed relative to the line; now find the line's height in the picture
  const topOfArcs = Math.min(0, ...parts.map((p) => p.lab.y - font * 0.85), -(S.zeroTick / 2) - 2, turnAt ? turnAt.y - 22 * S.turnScale : 0);
  const turnH = turn && S.turnRow ? S.turnRow : 0;
  const baseY = Math.round(S.top + turnH - topOfArcs);
  const H = Math.round(baseY + S.bottom);

  return {
    size, W, H, baseY, lo, hi, minor, major, ppu, left, right, start, change, end, reveal, picked, crowd, turn, turnAt,
    ticks, keyLabels, caps, parts, yFoot,
    x0: x(lo) - S.overhang, x1: x(hi) + S.overhang, zeroX: x(0), startX, endX,
    pickX: picked != null ? x(picked) : null, S,
  };
}

// ---- drawing it ------------------------------------------------------------------------------------------------

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const f1 = (n) => Math.round(n * 10) / 10;

function arcPath(p, baseY) {
  const y = baseY + p.yFoot, yEnd = baseY + p.yEnd;
  const k = p.h / 0.75;               // a curve with flat control points peaks at 3/4 of their height
  return `M${f1(p.x0)} ${f1(y)} C${f1(p.x0)} ${f1(y - k)} ${f1(p.x1)} ${f1(y - k)} ${f1(p.x1)} ${f1(yEnd)}`;
}

// The turn-around mark, drawn for a hop going up the line (the caller flips it for one going down): a dashed
// stroke the way the sign seems to say, a loop, and a solid arrow the way the hop really goes.
const UTURN = '<path class="ghost" d="M15 0 H-6"/><path d="M-6 0 A7 7 0 0 1 -6 -14 H11"/><path class="head" d="M20 -14 l-10 -6.5 v13z"/>';

function svgFor(L) {
  const S = L.S, b = L.baseY, tiny = L.size === 'inline';
  const out = [];
  out.push(`<svg class="bm-nl-svg" viewBox="0 0 ${L.W} ${L.H}" width="${L.W}" height="${L.H}" aria-hidden="true" focusable="false">`);
  // the turn-around words along the top
  if (L.turn && S.turnFont) {
    out.push(`<text class="nl-turn" x="${L.W / 2}" y="${S.top + S.turnFont}" text-anchor="middle" font-size="${S.turnFont}">${esc(L.turn.text)}</text>`);
  }
  // the line: the negative half and the positive half are drawn in slightly different colours
  const zx = Math.max(L.x0, Math.min(L.x1, L.zeroX));
  if (L.lo < 0) out.push(`<line class="nl-track neg" x1="${f1(L.x0 + 2)}" y1="${b}" x2="${f1(zx)}" y2="${b}" stroke-width="${S.lineW}"/>`);
  if (L.hi > 0) out.push(`<line class="nl-track pos" x1="${f1(zx)}" y1="${b}" x2="${f1(L.x1 - 2)}" y2="${b}" stroke-width="${S.lineW}"/>`);
  const ea = S.endArrow, eh = ea * 0.62;
  out.push(`<path class="nl-end ${L.lo < 0 ? 'neg' : 'pos'}" d="M${f1(L.x0 - 2)} ${b} l${ea} ${-eh} v${2 * eh}z"/>`);
  out.push(`<path class="nl-end ${L.hi > 0 ? 'pos' : 'neg'}" d="M${f1(L.x1 + 2)} ${b} l${-ea} ${-eh} v${2 * eh}z"/>`);
  // ticks and their numbers
  const tickLine = (t, cls = '') => {
    const h = t.zero ? S.zeroTick : t.major ? S.tickMajor : S.tickMinor;
    return `<line class="nl-tick${t.zero ? ' zero' : t.neg ? ' neg' : ' pos'}${t.major ? ' major' : ''}${cls}" x1="${f1(t.x)}" y1="${f1(b - h / 2)}" x2="${f1(t.x)}" y2="${f1(b + h / 2)}"/>`;
  };
  for (const t of L.ticks) {
    out.push(tickLine(t));
    if (t.label) out.push(`<text class="nl-num${t.neg ? ' neg' : ''}${t.late ? ' late' : ''}" x="${f1(t.x)}" y="${b + S.labelY - 2}" text-anchor="middle" font-size="${S.tickFont}">${t.label}</text>`);
  }
  // thin lines from key numbers pushed off their spot back to it
  const keyTop = (k) => b + S.labelY + (tiny ? 0 : 1) - S.keyFont * 0.82 - (k.kind === 'end' ? (tiny ? 1.5 : 4) : 0);
  const dotOf = { end: S.landR, start: S.dotR, zero: S.zeroTick / 2, pick: S.pickR };
  for (const k of L.keyLabels) {
    if (!k.lead) continue;
    const from = Math.max(k.x - k.w / 2 + 5, Math.min(k.x + k.w / 2 - 5, k.at));   // the label's nearest top corner
    out.push(`<line class="nl-lead ${k.kind}" x1="${f1(from)}" y1="${f1(keyTop(k) - 2)}" x2="${f1(k.at)}" y2="${f1(b + dotOf[k.kind] + 2)}"/>`);
  }
  // the hop's arcs, arrowheads and labels (hidden at first when animating)
  L.parts.forEach((p, i) => {
    out.push(`<path class="nl-arc" data-part="${i}" d="${arcPath(p, b)}" stroke-width="${tiny ? 2.4 : 4}"/>`);
    const tipY = b + L.yFoot + 1, len = S.arrowLen * p.arrow, half = S.arrowHalf * p.arrow;
    out.push(`<path class="nl-arrow" data-part="${i}" d="M${f1(p.x1)} ${f1(tipY)} L${f1(p.x1 - half)} ${f1(tipY - len)} L${f1(p.x1 + half)} ${f1(tipY - len)}z"/>`);
    if (!p.showLabel) return;
    if (p.lab.lead) out.push(`<line class="nl-arclead" data-part="${i}" x1="${f1(p.lab.x)}" y1="${f1(b + p.lab.y + S.arcFont * 0.2 + 3)}" x2="${f1((p.x0 + p.x1) / 2)}" y2="${f1(b + p.top - 3)}"/>`);
    out.push(`<text class="nl-arclab" data-part="${i}" x="${f1(p.lab.x)}" y="${f1(b + p.lab.y)}" text-anchor="middle" font-size="${S.arcFont}">${esc(p.label)}</text>`);
  });
  // the start dot, the landing dot and the dot that rides along the hop
  out.push(`<circle class="nl-start" cx="${f1(L.startX)}" cy="${b}" r="${S.dotR}"/>`);
  if (L.parts.length) {
    out.push(`<g class="nl-land" transform="translate(${f1(L.endX)} ${b})"><circle r="${S.landR}"/></g>`);
    out.push(`<circle class="nl-rider" cx="${f1(L.startX)}" cy="${f1(b + L.yFoot)}" r="${tiny ? 3.5 : 7}"/>`);
  }
  // zero again, on top of the dots and arrowheads: it is the one mark that must always show
  const zt = L.ticks.find((t) => t.zero);
  if (zt) out.push(tickLine(zt, ' top'));
  // the kid's pick: a cross on the line (on top, so no dot hides it), when it has room there
  if (L.pickX != null && !L.crowd) {
    const r = S.pickR;
    out.push(`<path class="nl-pickmark" d="M${f1(L.pickX - r)} ${f1(b - r)} L${f1(L.pickX + r)} ${f1(b + r)} M${f1(L.pickX + r)} ${f1(b - r)} L${f1(L.pickX - r)} ${f1(b + r)}"/>`);
  }
  // the turn-around: an arrow that points the "obvious" way and swings round (while it animates), and the
  // mark that stays in the finished picture
  if (L.turnAt) {
    const { x, y, dir } = L.turnAt, len = 20;
    out.push(`<g class="nl-flip" transform="translate(${f1(x)} ${f1(b + y - 7)}) scale(${L.turn.from} 1)">` +
      `<path d="M${-len} 0 H${len - 9}" stroke-width="4"/><path class="head" d="M${len} 0 l-11 -7.5 v15z"/></g>`);   // drawn pointing up the line (right); scale −1 turns it to point down
    out.push(`<g class="nl-uturn" transform="translate(${f1(x)} ${f1(b + y)}) scale(${dir * S.turnScale} ${S.turnScale})">${UTURN}</g>`);
  }
  // the key numbers: start, zero, the landing (in a pill), the pick (in an outlined box)
  for (const k of L.keyLabels) {
    const y = b + S.labelY + (tiny ? 0 : 1);
    if (k.kind === 'end') {
      const pw = k.w, ph = S.keyFont + (tiny ? 3 : 8);
      out.push(`<g class="nl-endlab${L.reveal ? '' : ' guess'}"><rect x="${f1(k.x - pw / 2)}" y="${f1(y - S.keyFont * 0.82 - (ph - S.keyFont) / 2)}" width="${f1(pw)}" height="${f1(ph)}" rx="${f1(ph / 2.4)}"/>` +
        `<text x="${f1(k.x)}" y="${f1(y)}" text-anchor="middle" font-size="${S.keyFont}">${esc(k.text)}</text></g>`);
    } else if (k.kind === 'pick' && !tiny) {
      const pw = k.w, ph = S.keyFont + 6;
      out.push(`<g class="nl-pickkey"><rect class="nl-pickbox" x="${f1(k.x - pw / 2)}" y="${f1(y - S.keyFont * 0.82 - 3)}" width="${f1(pw)}" height="${f1(ph)}" rx="6"/>` +
        `<text class="nl-key pick" x="${f1(k.x)}" y="${f1(y)}" text-anchor="middle" font-size="${S.keyFont}">${esc(k.text)}</text></g>`);
    } else {
      out.push(`<text class="nl-key ${k.kind}${k.v < 0 ? ' neg' : ''}" x="${f1(k.x)}" y="${f1(y)}" text-anchor="middle" font-size="${S.keyFont}">${esc(k.text)}</text>`);
    }
  }
  for (const c of L.caps) {
    const inner = c.parts.length > 1 ? c.parts.map((p) => `<tspan class="${p.kind}">${esc(p.text)}</tspan>`).join('') : esc(c.text);
    out.push(`<text class="nl-cap ${c.kind}" x="${f1(c.x)}" y="${b + S.capY}" text-anchor="middle" font-size="${S.capFont}" style="white-space:pre">${inner}</text>`);
  }
  out.push('</svg>');
  return out.join('');
}

// A sentence for screen readers (and the tests): "Start at −10. Up 10 to zero, then 8 more. Lands on 8." With the
// answer hidden it never says where the hop ends: "Start at −6. Up 6. Where does it land?"
export function describeHop({ start, change, reveal = true }) {
  const end = start + change, dir = change > 0 ? 'Up' : 'Down';
  if (!change) return `Start at ${numText(start)}.`;
  let hop;
  if (start !== 0 && end !== 0 && Math.sign(start) !== Math.sign(end)) hop = `${dir} ${Math.abs(start)} to zero, then ${reveal ? `${Math.abs(end)} more` : 'some more'}.`;
  else hop = `${dir} ${Math.abs(change)}${end === 0 && reveal ? ' to zero' : ''}.`;
  return `Start at ${numText(start)}. ${hop} ${reveal ? `Lands on ${numText(end)}.` : 'Where does it land?'}`;
}

// ---- the stylesheet ----------------------------------------------------------------------------------------------

let stylesPromise = null;
// Adds numberline.css to the page once, and loads the Bitter font it uses. Resolves when both are in (or after
// 2.5 s, whatever happens). The layout is worked out with Bitter's own widths, and a page only fetches a font
// once some text needs it, so calling this early (at boot) means the very first line is drawn in Bitter
// rather than in a wider stand-in font for a moment.
export function ensureNumberLineStyles() {
  if (stylesPromise) return stylesPromise;
  if (typeof document === 'undefined') return (stylesPromise = Promise.resolve());
  const href = new URL('./numberline.css', import.meta.url).href;
  let link = [...document.querySelectorAll('link[rel="stylesheet"]')].find((l) => l.href === href);
  const font = () => {
    try { return document.fonts ? document.fonts.load('700 21px Bitter').then(() => {}, () => {}) : Promise.resolve(); } catch (e) { return Promise.resolve(); }
  };
  stylesPromise = new Promise((done) => {
    setTimeout(done, 2500);
    if (link && link.sheet) { font().then(done); return; }
    if (!link) {
      link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = href;
      document.head.appendChild(link);
    }
    link.addEventListener('load', () => font().then(done)); link.addEventListener('error', () => done());
  });
  return stylesPromise;
}

// 'light' when the nearest solid background behind the container is pale, else 'dark'.
function themeBehind(node) {
  try {
    for (let n = node; n && n.nodeType === 1; n = n.parentElement) {
      const m = getComputedStyle(n).backgroundColor.match(/rgba?\(([^)]+)\)/);
      if (!m) continue;
      const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat);
      if (a < 0.5) continue;
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55 ? 'light' : 'dark';
    }
  } catch (e) { /* no styles to read: fall back */ }
  return 'dark';
}

// ---- showing it ----------------------------------------------------------------------------------------------------

export function showNumberLine(container, opts = {}) {
  ensureNumberLineStyles();
  // no size given: the full one, or the shorter one when the window is short (a phone held sideways)
  const short = typeof innerHeight === 'number' && innerHeight > 0 && innerHeight < 500;
  const size = opts.size === 'inline' ? 'inline' : opts.size === 'compact' || (!opts.size && short) ? 'compact' : 'full';
  const theme = opts.theme === 'light' || opts.theme === 'dark' ? opts.theme : themeBehind(container);
  const backing = opts.backing != null ? !!opts.backing : size !== 'inline' && theme === 'dark';
  const start = Math.round(Number(opts.start) || 0);
  const change = Math.round(Number(opts.change) || 0);
  if (opts.result != null && Number(opts.result) !== start + change) {
    console.warn(`showNumberLine: result ${opts.result} is not start + change (${start} + ${change}); drawing ${start + change}`);
  }
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animate = opts.animate !== false && !reduced;

  const el = document.createElement(size === 'inline' ? 'span' : 'figure');
  el.className = `bm-nl bm-nl--${theme} bm-nl--${size}${size === 'compact' ? ' bm-nl--full' : ''}${backing ? ' bm-nl--backing' : ''}`;
  el.setAttribute('role', 'img');
  container.appendChild(el);

  // The width: what the caller asked for, else the room the container gives (less the backing's padding).
  let width = Number(opts.width) || 0;
  if (!width) {
    const cw = container.clientWidth || (size === 'inline' ? 240 : 760);
    // a very long line spreads the eye too far: the full one stops at 960 px and sits in the middle
    width = size === 'inline' ? Math.min(cw, 320) : Math.min(960, cw - (backing ? (size === 'compact' ? 20 : 36) : 0));
  }
  const L = layoutNumberLine({ ...opts, start, change, width, size });
  const label = describeHop({ start, change, reveal: L.reveal });
  el.setAttribute('aria-label', `Number line. ${label}${opts.reason ? ' ' + opts.reason : ''}`);
  el.innerHTML = svgFor(L) + (opts.reason && size !== 'inline' ? `<figcaption class="bm-nl-reason">${esc(opts.reason)}</figcaption>` : '');
  const svg = el.querySelector('svg');
  if (size === 'inline') { svg.style.width = `${L.W}px`; svg.style.height = `${L.H}px`; } else svg.style.maxWidth = `${L.W}px`;

  const $$ = (q) => [...el.querySelectorAll(q)];
  const arcs = $$('.nl-arc'), arrows = $$('.nl-arrow'), arcLabs = $$('.nl-arclab, .nl-arclead');
  const land = el.querySelector('.nl-land'), rider = el.querySelector('.nl-rider'), flip = el.querySelector('.nl-flip'), uturn = el.querySelector('.nl-uturn');
  const endLab = el.querySelector('.nl-endlab'), endCaps = $$('.nl-cap.end, .nl-lead.end'), reasonEl = el.querySelector('.bm-nl-reason');
  const late = $$('.nl-num.late');
  const lens = arcs.map((a) => { try { return a.getTotalLength(); } catch (e) { return 0; } });
  const landAt = { x: L.endX, y: L.baseY };

  const setOpacity = (n, v) => { if (n) n.style.opacity = String(v); };
  const partAt = (i) => (n) => Number(n.getAttribute('data-part')) === i;

  function finalState() {
    arcs.forEach((a) => { a.style.strokeDasharray = ''; a.style.strokeDashoffset = ''; a.style.opacity = '1'; });
    arrows.forEach((n) => setOpacity(n, 1));
    arcLabs.forEach((n) => setOpacity(n, 1));
    if (land) { land.setAttribute('transform', `translate(${f1(landAt.x)} ${landAt.y}) scale(1)`); setOpacity(land, 1); }
    if (rider) setOpacity(rider, 0);
    setOpacity(flip, 0); setOpacity(uturn, 1);
    late.forEach((n) => setOpacity(n, 0));
    setOpacity(endLab, 1); endCaps.forEach((n) => setOpacity(n, 1)); setOpacity(reasonEl, 1);
  }

  let raf = 0, finished = false, resolveDone;
  const done = new Promise((r) => { resolveDone = r; });
  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    finalState();
    el.classList.add('is-done');
    resolveDone();
  }

  if (!animate || !L.parts.length) {
    finish();
  } else {
    // Starting state: the line, the ticks, the start dot; the hop not drawn yet. With the answer showing, the
    // plain numbers near the landing stay up until the answer comes in; with it hidden, the "?" is there from
    // the start (it gives nothing away) and those numbers stay out.
    arcs.forEach((a, i) => { a.style.strokeDasharray = `${lens[i]} ${lens[i] + 10}`; a.style.strokeDashoffset = `${lens[i]}`; });
    arrows.forEach((n) => setOpacity(n, 0));
    arcLabs.forEach((n) => setOpacity(n, 0));
    setOpacity(land, 0); setOpacity(reasonEl, 0); setOpacity(rider, 0); setOpacity(uturn, 0);
    setOpacity(endLab, L.reveal ? 0 : 1); endCaps.forEach((n) => setOpacity(n, L.reveal ? 0 : 1));
    late.forEach((n) => setOpacity(n, L.reveal ? 1 : 0));

    const turnMs = flip ? TURN_MS : 0;
    const hopMs = HOP_MS;
    const shares = L.parts.map((p) => p.share);
    const total = turnMs + hopMs + POP_MS + FADE_MS;
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const turnPos = L.turnAt ? `translate(${f1(L.turnAt.x)} ${f1(L.baseY + L.turnAt.y - 7)})` : '';
    let t0 = 0;
    const frame = (now) => {
      if (!t0) t0 = now;
      const t = now - t0;
      // 1) the turn-around: the arrow points the obvious way, swings round, holds; as the hop begins it gives
      //    way to the mark that stays (dashed the obvious way, a loop, solid the real way)
      if (flip) {
        const a = Math.min(1, Math.max(0, (t - TURN_HOLD) / TURN_SWING));
        const sx = L.turn.from + (L.turn.to - L.turn.from) * ease(a);
        flip.setAttribute('transform', `${turnPos} scale(${(Math.abs(sx) < 0.04 ? 0.04 * Math.sign(L.turn.to) : sx).toFixed(3)} 1)`);
        // the arrow fades out first, then the mark fades in (they sit in the same spot)
        setOpacity(flip, 1 - Math.min(1, Math.max(0, (t - turnMs) / 150)));
        setOpacity(uturn, Math.min(1, Math.max(0, (t - turnMs - 150) / 200)));
      }
      // 2) the hop: each part draws in turn while the rider dot travels along it
      const h = Math.min(1, Math.max(0, (t - turnMs) / hopMs));
      let acc = 0;
      L.parts.forEach((p, i) => {
        const a0 = acc, a1 = acc + shares[i];
        acc = a1;
        const f = Math.min(1, Math.max(0, (h - a0) / (a1 - a0)));
        const fe = ease(f);
        arcs[i].style.strokeDashoffset = `${(1 - fe) * lens[i]}`;
        if (f > 0 && f < 1 && rider) {
          try {
            const pt = arcs[i].getPointAtLength(fe * lens[i]);
            rider.setAttribute('cx', f1(pt.x)); rider.setAttribute('cy', f1(pt.y));
            setOpacity(rider, 1);
          } catch (e) { /* no geometry yet */ }
        }
        const doneAt = turnMs + a1 * hopMs;
        const show = Math.min(1, Math.max(0, (t - doneAt + 60) / FADE_MS));
        arrows.filter(partAt(i)).forEach((n) => setOpacity(n, f >= 0.97 ? 1 : 0));
        arcLabs.filter(partAt(i)).forEach((n) => setOpacity(n, show));
      });
      // 3) the landing: the dot grows in with a little bounce, then the answer and its caption, while the plain
      //    numbers under it fade out
      const p = (t - turnMs - hopMs) / POP_MS;
      if (p > 0 && land) {
        const s = p >= 1 ? 1 : p < 0.7 ? (p / 0.7) * 1.25 : 1.25 - ((p - 0.7) / 0.3) * 0.25;
        land.setAttribute('transform', `translate(${f1(landAt.x)} ${landAt.y}) scale(${s.toFixed(3)})`);
        setOpacity(land, 1);
        setOpacity(rider, 0);
        const lab = Math.min(1, p * 1.5);
        if (L.reveal) { setOpacity(endLab, lab); endCaps.forEach((n) => setOpacity(n, lab)); late.forEach((n) => setOpacity(n, 1 - lab)); }
        setOpacity(reasonEl, Math.min(1, Math.max(0, (t - turnMs - hopMs - 80) / FADE_MS)));
      }
      if (t >= total) finish(); else raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  return {
    el,
    done,
    finish,
    remove() { finish(); el.remove(); },
  };
}

// ---- the "still thinking?" timer -----------------------------------------------------------------------------------

// watchHesitation({ after = 8000, onShow }) -> { answered(), cancel(), restart() }
// Starts at once. If `after` ms go by with no answered() or cancel(), onShow() is called (once). answered() and
// cancel() both stop it (answered is the one to call when the kid picks; cancel when the card goes away).
// restart() starts the wait again from now, for the next card.
export function watchHesitation({ after = 8000, onShow } = {}) {
  let timer = null, fired = false;
  const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };
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
    get waiting() { return !!timer; },
    get shown() { return fired; },
  };
}
