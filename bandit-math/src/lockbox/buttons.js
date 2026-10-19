// The move buttons under the working line, rebuilt after every move.
//
// A set holds (4 buttons; fewer only when the line has fewer legal moves):
//   - 2 productive moves when the line has two (they bring x = N closer; other right ways show and all count);
//   - 1 classic trap: the same number with the wrong sign (−6 next to +6), the wrong undo (−12 or ·12 on 12x = 24),
//     part of the number (÷2 on 12x), or a number locked inside brackets (−2 on 3(x + 2) = 18);
//   - 1 legal but unhelpful move (it plays out honestly, it just doesn't get closer);
//   - and the trap that fools this kid most often, when there is room.
// Every button is a legal move of the rung: never ÷0, ·0, ·x or ÷x, nothing past ±99, no fractions or negatives
// before their rungs, and no two buttons that do the same thing.
// The steps card (steps.js) has its own order; a move that follows it counts as productive, and one of those moves
// always shows, so a kid reading the card can always find its next move on a button.
// Layout: the top row is + and −, the bottom row is · and ÷ (and the flip, brackets, combine); the slot of the right
// answer is shuffled within its row every time.

import { closerMoves, moveLabel, moveId, applyMove, lineKey } from './engine.js';

export const TRAP_TAGS = ['sign', 'undo', 'part', 'inside'];

const absEq = (a, b) => Math.abs(a.n) === Math.abs(b.n) && a.d === b.d;

// Which kind of slip a not-closer move is, judged against the productive moves on this line.
export function trapTag(m, goods, l) {
  let best = 'meh';
  const rank = { sign: 4, undo: 3, part: 2, inside: 1, meh: 0 };
  const take = (tag) => { if (rank[tag] > rank[best]) best = tag; };
  for (const g of goods) {
    if (m.k === 'add' && g.k === 'add' && m.term.t === g.term.t && m.term.v.eq(g.term.v.neg())) take('sign');
    if ((m.k === 'div' || m.k === 'mul') && m.k === g.k && m.f.eq(g.f.neg())) take('sign');
    if (g.k === 'flip' && m.k === 'add') take('sign');
    if (m.k === 'div' && g.k === 'div' && m.f.sign() === g.f.sign() && m.f.isInt() && g.f.isInt()
      && Math.abs(g.f.n) % Math.abs(m.f.n) === 0 && !absEq(m.f, g.f)) take('part');
    if (m.k === 'div' && g.k === 'div' && m.f.sign() !== g.f.sign() && !absEq(m.f, g.f)) take('part');
    if (g.k === 'div' && ((m.k === 'add' && m.term.t === 'n' && absEq(m.term.v, g.f)) || (m.k === 'mul' && absEq(m.f, g.f)))) take('undo');
    if (g.k === 'mul' && ((m.k === 'div' && absEq(m.f, g.f)) || (m.k === 'add' && m.term.t === 'n' && absEq(m.term.v, g.f)))) take('undo');
  }
  if (best === 'meh' && m.k === 'add' && m.term.t === 'n') {
    const inner = [...l.L, ...l.R].filter((t) => t.t === 'b').flatMap((t) => t.in).filter((t) => t.t === 'n');
    if (inner.some((t) => absEq(t.v, m.term.v))) best = 'inside';
  }
  return best;
}

const rowOf = (m) => (m.k === 'add' ? 0 : 1);

// buildButtons(line, stage, { count, rng, fav, steps }) ->
//   { slots: [4 entries, each a button or null], goods: [...], d }
// A button is { move, id, label, key, role: 'good'|'trap'|'meh', tag }.
// fav is this kid's most frequent trap tag (or null). rng is a generate.js makeRng().
// goal/goalId are passed when "closer" means reaching something other than x = N (the vault rung's verdicts).
// steps: the moves that follow the steps card from this line (steps.js stepsMoves); they count as productive.
// cm and keyOf are for lines that aren't one equation (the inequalities' rooms, ineq.js): cm is that line's own
// { d, closer, all } (as engine.js closerMoves), keyOf(move) the key of the line the move makes.
export function buildButtons(l, st, { count = 4, rng, fav = null, goal = null, goalId = null, steps = [], cm = null, keyOf = null } = {}) {
  const rand = rng ? rng.next : Math.random;
  const pickOne = (arr) => arr[Math.floor(rand() * arr.length)];
  if (!cm) cm = closerMoves(l, st, goal ? { goal, goalId } : {});
  const keyFor = keyOf || ((m) => { const r = applyMove(l, m); return r ? lineKey(r.out) : null; });
  const goodKeys = new Set(cm.closer.map((c) => c.key));
  const stepKeys = new Set();
  for (const m of steps) { const k = keyFor(m); if (k) { stepKeys.add(k); goodKeys.add(k); } }
  const sol = { d: cm.d };
  const all = cm.all.map((c) => ({ move: c.move, id: moveId(c.move), label: moveLabel(c.move), key: c.key, dAfter: c.d }));
  const goods = all.filter((b) => goodKeys.has(b.key));
  goods.forEach((b) => { b.role = 'good'; b.tag = null; b.card = stepKeys.has(b.key); });
  const goodMoves = goods.map((b) => b.move);
  const rest = all.filter((b) => !goodKeys.has(b.key));
  rest.forEach((b) => { b.tag = trapTag(b.move, goodMoves, l); b.role = b.tag === 'meh' ? 'meh' : 'trap'; });

  // Prefer the plainest productive move first: cancelling a number, then an x-term, then ÷/·, then the rest.
  const goodRank = (b) => (b.move.k === 'add' ? (b.move.term.t === 'n' ? 0 : 1) : b.move.k === 'div' || b.move.k === 'mul' ? 2 : 3);
  const chosen = [];
  const take = (b) => { if (b && !chosen.includes(b)) chosen.push(b); return b; };
  // the first productive button does the step the card is on: its own move (open the brackets, clear the division,
  // tidy, free x), or, while the card is sorting x's from numbers, any of the cancelling moves that do that
  const canonKey = steps[0] ? keyFor(steps[0]) : null;
  const stepAt = (b) => { const i = steps.findIndex((m) => moveId(m) === b.id); return i < 0 ? 99 : i; };
  const cardGoods = goods.filter((b) => stepKeys.has(b.key)
    && (steps[0].k === 'add' ? b.move.k === 'add' : b.key === canonKey));
  if (goods.length) {
    const ranked = [...(cardGoods.length ? cardGoods : goods)].sort((a, b) => goodRank(a) - goodRank(b));
    const best = ranked.filter((b) => goodRank(b) === goodRank(ranked[0]));
    // (the card's own way first among those: −12 rather than −82 when the card keeps x on the left)
    const firstAt = Math.min(...best.map(stepAt));
    take(pickOne(best.filter((b) => stepAt(b) === firstAt)));
  }
  const traps = rest.filter((b) => b.role === 'trap');
  const mehs = rest.filter((b) => b.role === 'meh');
  // Each kind of button is a list of tiers, best first: the kid's own trap, then the classic traps in order.
  const trapTiers = (want) => [
    want ? traps.filter((b) => b.tag === want) : [],
    ...TRAP_TAGS.map((tag) => traps.filter((b) => b.tag === tag)),
  ];
  const mehTiers = () => [mehs];
  const secondTiers = () => [goods];
  // Pick from the first kind (then tier) that has a button left. While one row already holds two buttons, a button
  // for the other row is looked for first through every kind, so + and − stay on top and ·, ÷ below whenever the
  // line has moves of both sorts. pickTrap: the row is only preferred within each kind instead, so a believable trap
  // (+12 next to −12) beats a dull move that would fit the other row; it overflows a row onto the other.
  const rowCount = (r) => chosen.filter((b) => rowOf(b.move) === r).length;
  const pickIn = (perKind, kinds) => {
    // (once a row holds more than two it spills over anyway, so the balancing stops)
    const spilled = rowCount(0) > 2 || rowCount(1) > 2;
    const room = spilled ? null : rowCount(0) >= 2 ? 1 : rowCount(1) >= 2 ? 0 : null;
    const stricts = room === null ? [false] : [true, false];
    const look = (tiers, strict) => {
      for (const tier of tiers) {
        const left = tier.filter((b) => !chosen.includes(b) && (!strict || rowOf(b.move) === room));
        if (left.length) return pickOne(left);
      }
      return null;
    };
    if (perKind) {
      for (const tiers of kinds) for (const strict of stricts) { const b = look(tiers, strict); if (b) return b; }
    } else {
      for (const strict of stricts) for (const tiers of kinds) { const b = look(tiers, strict); if (b) return b; }
    }
    return null;
  };
  const pickFrom = (...kinds) => pickIn(false, kinds);
  const pickTrap = (...kinds) => pickIn(true, kinds);
  // At 4 buttons a second right way shows too (2 productive buttons in all), so two wrong ones are left to
  // steer past: on 4x + 12 = −3x + 82 both +3x and −12 (and −4x, −82) are good first moves. The card’s own
  // moves come first, then the plainest. They are placed before the traps, so the row balancing below can't crowd
  // them out (on a brackets box "Open brackets" and the ÷(−3) trap would otherwise fill the ·/÷ row first).
  const MAX_GOOD = 2;
  if (count >= 4) {
    // (a different sort of move first: after −12, the +3x that moves an x-term, not −82 as well)
    const sortOf = (b) => (b.move.k === 'add' ? `add${b.move.term.t}` : b.move.k);
    while (chosen.length < Math.min(MAX_GOOD, count - 1)) {
      const sorts = new Set(chosen.map(sortOf));
      const others = goods.filter((b) => !chosen.includes(b)).sort((a, b) => (b.card ? 1 : 0) - (a.card ? 1 : 0)
        || (sorts.has(sortOf(a)) ? 1 : 0) - (sorts.has(sortOf(b)) ? 1 : 0) || stepAt(a) - stepAt(b) || goodRank(a) - goodRank(b));
      if (!others.length) break;
      take(others[0]);
    }
  }
  // then the wrong ones: this kid's own trap, the classic traps, a legal but unhelpful move; a slot still empty after
  // that takes another good move rather than staying blank
  const wrongKinds = [
    () => pickFrom(trapTiers(fav), mehTiers(), secondTiers()),
    () => pickTrap(trapTiers(fav)) || pickFrom(mehTiers(), secondTiers()),
    () => pickFrom(mehTiers(), trapTiers(null), secondTiers()),
  ];
  for (let k = 0; count >= 2 && chosen.length < count && k < wrongKinds.length; k++) take(wrongKinds[k]());
  // never fewer than 2 buttons when the line allows it (a lone right answer teaches nothing)
  while (chosen.length < Math.min(2, all.length)) take(pickOne(all.filter((b) => !chosen.includes(b))));

  // place them: + and − on the top row, the rest on the bottom row, spilling over when a row is full
  const rows = [[], []];
  for (const b of chosen) rows[rowOf(b.move)].push(b);
  while (rows[0].length > 2) rows[1].push(rows[0].pop());
  while (rows[1].length > 2) rows[0].push(rows[1].pop());
  const slots = [];
  for (const r of rows) {
    const cells = [r[0] || null, r[1] || null];
    if (rand() < 0.5) cells.reverse();
    slots.push(...cells);
  }
  return { slots, goods, d: sol.d, all };
}
