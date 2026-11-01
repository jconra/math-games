// factors.js: ALL THE FACTORS OF A NUMBER, the top levels of "Protect the wagon" (src/levels/place/wagon.js), where a
// hold-up needs several bandits among fewer riders, not one rider wearing a missing number. The card says "All the
// factors of 48": every bandit wears a number that goes into 48 (2, 3, 4, 6, 8, 12), the townsfolk wear ones that don't
// (5, 7, 9, 10, 11). About half the riders are the gang. A number that fooled the kid comes back 2 to 4 answers later.
// The same small shape as the odds and evens (src/math/parity.js), so the wagon runs either the same way:
//   const F = makeFactors({ rand })
//   F.wave({ count, product, upTo }) -> { id, kind: 'factors', product, rule, table: null, targets: [{ n, good, trap }], hard }
//   F.answer(n, good) -> { right }      F.due() -> [{ n, good: false, trap, back: true }]
//   F.explain(n) -> { good, line, short, skip, anchor, also }      F.hint() -> the way to test a number
//   F.state.cur: the wave (its id: the wagon checks it still holds the wave)
//   factorsOf(product, upTo)    its factors from 2 up to upTo
//   gangProduct(a, b, upTo)     a number with enough factors for a gang, a x b itself if it has them, else the nearest
//                               that shares one of them
import { int, shuffle } from '../levels/kit.js';

export const FACTORS = { least: 3, most: 5 };   // bandits in a wave (and so factors a number must have)
export const factorsOf = (product, upTo = 12) => {
  const out = [];
  for (let d = 2; d <= upTo && d < product; d++) if (product % d === 0) out.push(d);
  return out;
};
export function gangProduct(a, b, upTo = 12) {
  const n = a * b;
  if (factorsOf(n, upTo).length >= FACTORS.least) return n;
  let best = 0, bd = Infinity;
  for (let m = 4; m <= upTo * upTo; m++) {
    if (factorsOf(m, upTo).length < FACTORS.least || (m % a && m % b)) continue;
    const d = Math.abs(m - n); if (d < bd) { bd = d; best = m; }
  }
  return best || 24;
}

export function makeFactors({ rand = Math.random } = {}) {
  const S = { cur: null, n: 0, clock: 0, soon: [] };
  function wave({ count = 8, product = 24, upTo = 12 } = {}) {
    const all = factorsOf(product, upTo), others = [];
    for (let d = 2; d <= upTo; d++) if (product % d) others.push(d);
    const goods = shuffle(all, rand).slice(0, Math.max(FACTORS.least, Math.min(FACTORS.most, Math.round(count / 2))));
    const traps = [];
    for (const b of S.soon.splice(0)) if (b.product === product && !goods.includes(b.n) && others.includes(b.n)) traps.push({ n: b.n, good: false, trap: 'back' });
    for (const n of shuffle(others, rand)) { if (goods.length + traps.length >= count) break; if (!traps.some((t) => t.n === n)) traps.push({ n, good: false, trap: 'other' }); }
    const targets = shuffle([...goods.map((n) => ({ n, good: true, trap: null })), ...traps], rand);
    S.n++;
    S.cur = { id: S.n, kind: 'factors', product, closed: false, targets: targets.map((x) => ({ ...x, done: 0 })) };
    return { id: S.n, kind: 'factors', product, table: null, rule: `All the factors of ${product}`, targets, hard: 1 };
  }
  function answer(n, good) {
    const c = S.cur, x = c ? c.targets.find((y) => y.n === n && !y.done) || c.targets.find((y) => y.n === n) : null;
    const right = typeof good === 'boolean' ? good : !!(x && x.good);
    S.clock++;
    if (x && !x.done) x.done = right ? 1 : -1;
    if (!right && c) S.soon.push({ n, product: c.product, due: S.clock + int(2, 4, rand) });
    return { right };
  }
  function due() {
    const c = S.cur;
    if (!c || c.targets.every((y) => !y.good || y.done === 1)) return [];
    const out = [];
    S.soon = S.soon.filter((s) => {
      if (s.due > S.clock || s.product !== c.product) return true;
      const old = c.targets.find((y) => y.n === s.n);
      if (old && !old.done) return false;
      if (old) old.done = 0; else c.targets.push({ n: s.n, good: false, trap: 'back', done: 0 });
      out.push({ n: s.n, good: false, trap: 'back', back: true });
      return false;
    });
    return out;
  }
  function explain(n) {
    const p = S.cur ? S.cur.product : n, good = p % n === 0;
    if (good) return { good, line: `${n} × ${p / n} = ${p}`, short: `${p} = ${n} × ${p / n}`, skip: null, anchor: null, also: null };
    // the number's own multiples round the product, the product in brackets where it would have to sit: 35 · 42 · (48) · 49 · 56
    const below = Math.floor(p / n), skip = [];
    for (let k = Math.max(1, below - 1); k <= below + 2; k++) { if (k === below + 1) skip.push(`(${p})`); skip.push(n * k); }
    return { good, line: `${n} doesn't go into ${p}: ${n} × ${below} = ${n * below} and ${n} × ${below + 1} = ${n * (below + 1)}`, short: `${n} misses ${p}`, skip, anchor: `${n}s:`, also: null };
  }
  const hint = () => { const p = S.cur ? S.cur.product : 0; return `A factor goes into ${p} with nothing left over. Try it: what times that number makes ${p}?`; };
  return { state: S, wave, answer, due, explain, hint };
}
