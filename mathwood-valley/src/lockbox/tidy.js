// "Do the arithmetic": after a move, the kid picks the tidied line from three cards laid out the same way.
//
// On 3x − 10 = 5x − 18, pressing +18 writes 3x − 10 + 18 = 5x − 18 + 18 for a beat, and the cards are
//   3x + 8 = 5x        right
//   3x − 28 = 5x       sign slip: −10 + 18 worked as −10 − 18 (the signs combined)
//   3x − 10 = 5x       one side only: the +18 was only done to the right side
// The move itself is the kid's own; only the adding up is tested here, which is where signed numbers trip kids up.
//
// tidyChoices(before, move, { rng, fav }) -> null when the move leaves no real sum to work out, else
//   { mid, out, sums: [{ side, kind: 'n'|'x', a, b, c, mixed }], cards: [{ line, text, tag, right, sum }] }
//   (a + b = c, all whole numbers; mixed = one of a, b is negative and the other positive)
// The wrong cards are the real slips, tagged so the ladder can count them:
//   sign     subtracted instead of added: −10 + 18 written as −28, 18 + 6 as 12, −6 + 6 as −12
//   flip     the right size with the wrong sign: −10 + 18 written as −8
//   drop     both signs dropped: −10 + 18 written as 28
//   oneside  the move done to one side only
// fav (the kid's most frequent slip tag, or null) is used for one of the two wrong cards when it fits.

import { applyMove, lineText, num, xt, cloneLine } from './engine.js';

export const TIDY_TAGS = ['sign', 'flip', 'drop', 'oneside'];

const isInt = (f) => f.d === 1;

// The sums a move makes, read from the move's events. Only whole numbers, and only real sums (0 + 6 is not one).
export function sumsOf(before, move) {
  if (!move || move.k !== 'add') return null;
  const r = applyMove(before, move, true);
  if (!r) return null;
  const sums = [];
  for (const side of ['L', 'R']) {
    for (const ev of r.ev[side]) {
      if (ev.kind !== 'zero' && ev.kind !== 'merge') continue;
      const A = r.mid[side][ev.a], B = r.mid[side][ev.b];
      if (!A || !B || A.t === 'b' || B.t === 'b') continue;
      const a = A.v, b = B.v;
      if (!isInt(a) || !isInt(b) || a.isZero() || b.isZero()) continue;
      const c = a.add(b);
      sums.push({ side, kind: A.t, a: a.n, b: b.n, c: c.n, mixed: Math.sign(a.n) !== Math.sign(b.n), ev });
    }
  }
  return { r, sums };
}

// The tidied side with one sum worked out wrong (value v instead of the right one).
function slipSide(r, sum, v) {
  const side = r.mid[sum.side].map((t) => ({ ...t }));
  const term = side[sum.ev.a];
  const out = side.filter((_, i) => i !== sum.ev.b);
  const at = out.indexOf(term);
  if (v === 0) out.splice(at, 1);
  else out[at] = sum.kind === 'x' ? xt(v) : num(v);
  // (one add makes at most one sum per side, so nothing else on the side needs working out)
  return out.length ? out : [num(0)];
}

export function tidyChoices(before, move, { rng = null, fav = null } = {}) {
  const got = sumsOf(before, move);
  if (!got || !got.sums.length) return null;
  const { r, sums } = got;
  const rand = rng ? rng.next : Math.random;
  const right = cloneLine(r.out);
  const rightText = lineText(right);
  // every slip that can be made here, as a candidate card
  const cands = [];
  for (const s of sums) {
    const slips = { sign: s.a - s.b };
    if (s.mixed && s.c !== 0) { slips.flip = -s.c; slips.drop = Math.abs(s.a) + Math.abs(s.b); }
    for (const [tag, v] of Object.entries(slips)) {
      const line = { ...cloneLine(r.out) };
      line[s.side] = slipSide(r, s, v);
      cands.push({ line, tag, sum: s, wrongValue: v });
    }
  }
  // one side only: the move done to the other side but not this one (this side stays as it was)
  for (const side of ['L', 'R']) {
    if (!sums.some((s) => s.side === side)) continue;
    const line = cloneLine(r.out);
    line[side] = cloneLine(before)[side];
    cands.push({ line, tag: 'oneside', sum: sums.find((s) => s.side === side), side });
  }
  const seen = new Set([rightText]);
  const usable = cands.map((c) => ({ ...c, text: lineText(c.line) })).filter((c) => {
    if (seen.has(c.text)) return false;
    seen.add(c.text);
    return true;
  });
  // the slip worth seeing most is on a sum that mixes a negative and a positive and doesn't come to zero
  // (−10 + 18), then any other real sum (18 + 6), then a zero pair (−6 + 6)
  const rank = (c) => (!c.sum ? 1 : c.sum.c === 0 ? 2 : c.sum.mixed ? 0 : 1);
  const pickTag = (tag, not) => {
    const opts = usable.filter((c) => c.tag === tag && !not.includes(c)).sort((a, b) => rank(a) - rank(b));
    if (!opts.length) return null;
    const best = opts.filter((c) => rank(c) === rank(opts[0]));
    return best[Math.floor(rand() * best.length)];
  };
  const wrong = [];
  const order1 = [fav, 'sign', 'flip', 'drop', 'oneside'].filter(Boolean);
  for (const t of order1) { const c = pickTag(t, wrong); if (c) { wrong.push(c); break; } }
  const order2 = ['oneside', 'flip', 'sign', 'drop'].filter((t) => t !== wrong[0]?.tag);
  for (const t of order2) { const c = pickTag(t, wrong); if (c) { wrong.push(c); break; } }
  if (wrong.length < 2) { const c = usable.find((u) => !wrong.includes(u)); if (c) wrong.push(c); }
  if (!wrong.length) return null;
  const cards = [{ line: right, text: rightText, tag: null, right: true, sum: null }, ...wrong.map((c) => ({
    line: c.line, text: c.text, tag: c.tag, right: false, sum: c.sum, wrongValue: c.wrongValue ?? null,
  }))];
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return { mid: r.mid, out: r.out, sums: sums.map(({ ev, ...s }) => s), cards };
}

// What Hob says after a wrong card: "−10 + 18 is 8, not −28." / "Both sides get the +18."
export function slipLine(card, move) {
  const MINUS = '−';
  const t = (n, kind) => {
    if (kind === 'x') return n === 1 ? 'x' : n === -1 ? `${MINUS}x` : `${n < 0 ? MINUS : ''}${Math.abs(n)}x`;
    return `${n < 0 ? MINUS : ''}${Math.abs(n)}`;
  };
  if (!card || card.right) return '';
  if (card.tag === 'oneside') {
    const v = move?.term?.v;
    const m = v ? `${v.n < 0 ? MINUS : '+'}${t(Math.abs(v.n), move.term.t)}` : 'move';
    return `Both sides get the ${m}.`;
  }
  const s = card.sum;
  if (!s) return 'Check each sum again.';
  const add = `${t(s.a, s.kind)} ${s.b < 0 ? MINUS : '+'} ${t(Math.abs(s.b), s.kind)}`;
  const c = s.c === 0 ? '0' : t(s.c, s.kind);
  return `${add} is ${c}, not ${card.wrongValue === 0 ? '0' : t(card.wrongValue, s.kind)}.`;
}
