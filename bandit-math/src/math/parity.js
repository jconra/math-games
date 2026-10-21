// parity.js: ODDS AND EVENS, the young levels of "Protect the wagon" (src/levels/place/wagon.js). The card says
// "Rope the evens" (or the odds): the bandits wear the even numbers, the townsfolk riding along wear odd ones. The
// numbers are picked so no shortcut but the real rule works:
//   near    the next-door number (7 next to 6 and 8), the likeliest slip
//   tens    up to 100: the tens digit even but the ones odd (47 among the evens), for a kid reading the first digit
//   other   any number of the other kind
// About half the riders are the gang. A number that fooled the kid comes back 2 to 4 answers later (due()).
// The same small shape as the times trainer's herd waves (src/math/times.js), so the wagon runs either the same way:
//   const P = makeParity({ rand })
//   P.wave({ count, want: 'even' | 'odd' | 'either', top }) -> { id, kind: 'parity', want, rule, table: 2, targets:
//                                                                [{ n, good, trap }], hard }
//   P.answer(n, good) -> { right }      P.due() -> [{ n, good: false, trap, back: true }]
//   P.explain(n) -> { good, line, short, skip, anchor, also }   (short: '8 = 4 pairs', for the card over a roped
//                                                                bandit; skip: the evens or odds round it, the pick in brackets)
//   P.hint() -> the rule of thumb      P.state.cur: the wave (its id: the wagon checks it still holds the wave)
// parityExample(gen, rand) -> { q, a } for the levels page (the same maker).

import { int, shuffle } from '../levels/kit.js';

const isEven = (n) => n % 2 === 0;
const PAIRS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

export function makeParity({ rand = Math.random } = {}) {
  const S = { cur: null, n: 0, clock: 0, soon: [] };
  function wave({ count = 8, want = 'even', top = 10 } = {}) {
    if (want === 'either') want = rand() < 0.5 ? 'even' : 'odd';
    const good = (n) => isEven(n) === (want === 'even');
    const lo = top <= 10 ? 1 : top <= 20 ? 1 : 10;
    const all = []; for (let n = lo; n <= top; n++) all.push(n);
    const nGood = Math.max(2, Math.min(Math.round(count / 2), all.filter(good).length));
    const goods = shuffle(all.filter(good), rand).slice(0, nGood);
    const used = new Set(goods), traps = [];
    const put = (n, trap) => { if (n >= lo && n <= top && !used.has(n) && !good(n)) { used.add(n); traps.push({ n, good: false, trap }); } };
    // misses waiting to come back go in first
    for (const b of S.soon.splice(0)) if (b.want === want && b.n <= top) put(b.n, b.trap);
    // the next-door numbers of the gang's own, then (up to 100) the tens look-alikes, then any of the other kind
    const nearMost = top > 20 ? Math.ceil((count - nGood) / 2) : count - nGood;
    for (const g of shuffle([...goods], rand)) { if (traps.length >= nearMost) break; put(g + (rand() < 0.5 ? 1 : -1), 'near'); }
    if (top > 20) for (let k = 0; k < 20 && traps.length < count - nGood; k++) {
      const tens = 2 * int(1, 4, rand) + (want === 'even' ? 0 : 1), ones = 2 * int(0, 4, rand) + (want === 'even' ? 1 : 0);
      put(10 * tens + ones, 'tens');
    }
    for (const n of shuffle(all.filter((x) => !good(x)), rand)) { if (traps.length >= count - nGood) break; put(n, 'other'); }
    const targets = shuffle([...goods.map((n) => ({ n, good: true, trap: null })), ...traps], rand);
    S.n++;
    S.cur = { id: S.n, kind: 'parity', want, top, closed: false, targets: targets.map((x) => ({ ...x, done: 0 })) };
    return { id: S.n, kind: 'parity', want, top, table: 2, rule: `Rope the ${want}s`, targets, hard: 1 };
  }
  function answer(n, good) {
    const c = S.cur;
    const x = c ? c.targets.find((y) => y.n === n && !y.done) || c.targets.find((y) => y.n === n) : null;
    const right = typeof good === 'boolean' ? good : !!(x && x.good);
    S.clock++;
    if (x && !x.done) x.done = right ? 1 : -1;
    if (!right && c) S.soon.push({ n, want: c.want, trap: (x && x.trap) || 'other', due: S.clock + int(2, 4, rand) });
    return { right };
  }
  function due() {
    const c = S.cur;
    if (!c || c.targets.every((y) => !y.good || y.done === 1)) return [];
    const out = [];
    S.soon = S.soon.filter((s) => {
      if (s.due > S.clock || s.want !== c.want) return true;
      const old = c.targets.find((y) => y.n === s.n);
      if (old && !old.done) return false;
      if (old) old.done = 0; else c.targets.push({ n: s.n, good: false, trap: s.trap, done: 0 });
      out.push({ n: s.n, good: false, trap: s.trap, back: true });
      return false;
    });
    return out;
  }
  function explain(n) {
    const c = S.cur, want = c ? c.want : 'even', even = isEven(n), good = even === (want === 'even');
    const kind = even ? 'even' : 'odd';
    let line, short;
    if (n <= 24) {
      const p = Math.floor(n / 2), left = n % 2;
      const pairs = p === 0 ? 'just one, with none to pair it with' : `${p === 1 ? 'one pair' : `${PAIRS[p] || p} pairs`}${left ? ' and 1 left over' : ''}`;
      line = `${n} is ${kind}: ${pairs}`;
      short = p === 0 ? '1 has no pair' : `${n} = ${p} pair${p === 1 ? '' : 's'}${left ? ' + 1' : ''}`;
    } else { line = `${n} is ${kind}: it ends in ${n % 10}`; short = `${n} ends in ${n % 10}`; }
    if (!good) line += `, not ${want}`;
    // the evens (or odds) round the pick, the pick in brackets where it sits: 4 · 6 · (7) · 8 · 10
    let lo = Math.max(want === 'even' ? 2 : 1, n - 5);
    if (isEven(lo) !== (want === 'even')) lo++;
    const skip = [];
    let placed = good;
    for (let v = lo; skip.length < 6; v += 2) {
      if (!placed && n < v) { skip.push(`(${n})`); placed = true; }
      skip.push(v);
    }
    if (!placed) skip.push(`(${n})`);
    return { good, line, short, skip, anchor: null, also: good ? null : `The ${want}s end in ${want === 'even' ? '0, 2, 4, 6 or 8' : '1, 3, 5, 7 or 9'}` };
  }
  function hint() {
    const c = S.cur, want = c ? c.want : 'even';
    return want === 'even' ? 'Even numbers make pairs with none left over: they end in 0, 2, 4, 6 or 8.'
      : 'Odd numbers have one left over when you make pairs: they end in 1, 3, 5, 7 or 9.';
  }
  return { topic: 'parity', state: S, wave, answer, due, explain, hint, endWave() { if (S.cur) S.cur.closed = true; } };
}

export function parityExample(g, rand) {
  const w = makeParity({ rand }).wave({ count: 8, want: g.want, top: g.top });
  return { q: `${w.rule}: ${w.targets.map((x) => x.n).join(' · ')}`, a: w.targets.filter((x) => x.good).map((x) => x.n).sort((a, b) => a - b).join(', ') };
}
