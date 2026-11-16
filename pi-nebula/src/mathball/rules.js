// MATHBALL'S GOAL RULES: what a goal's sign says and which balls it takes. Plain numbers and words (no three.js, no
// page), so the game, the lab (labs/mathball/) and node (pi-nebula/tests/mathball.test.mjs) all read the same rules.
// From round three's rules (the game's maker's own idea, 2026-11-16: "there could be a goal that said factors of 24,
// and there could be one that says multiples of 8. So the 8 ball could go in either").
//
//   ruleOf('mult:3')          one rule from its short name (the ladder writes rules this way): { id, sign: [words,
//                             number?] (the board: the words small over the number big), say (plain words), test(v),
//                             help (one plain line for Help), list (examples), why(ball) (why a ball fits or doesn't) }
//                             names: even, odd, less:N, more:N, mult:N, fact:N, square, prime, tens:N, ones:N
//   value(ball)               a ball's number as an exact fraction { n, d } (a ball is a whole number, or '3/4', '0.5')
//   fits(rule, ball)          does this ball go in this goal?
//   checkSet(rules, balls)    THE BALL CHECK (ARENA.md): every ball fits at least one goal and never every goal; every
//                             goal takes at least `per` of the balls (a dead goal is no fun)
//   pickChange(rules, at, pool, balls, { held, rand })   a goal's rule changing: the spare rules that keep every ball
//                             on the court passing the check, the best of them; see below
//   dealable(rules, pool)     the balls of a pool that pass with these rules (fit one goal or more, never all)

// ── a ball's number ────────────────────────────────────────────────────────────────────────────────────────────────
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const frac = (n, d = 1) => { const g = gcd(n, d), s = d < 0 ? -1 : 1; return { n: (s * n) / g, d: (s * d) / g }; };
export function value(ball) {
  if (typeof ball === 'number') { if (!Number.isInteger(ball)) throw new Error('write decimals as strings: ' + ball); return frac(ball); }
  const s = String(ball).trim();
  let m = s.match(/^(\d+)\/(\d+)$/); if (m) return frac(+m[1], +m[2]);
  m = s.match(/^(\d*)\.(\d+)$/); if (m) return frac(+(m[1] || 0) * 10 ** m[2].length + +m[2], 10 ** m[2].length);
  m = s.match(/^\d+$/); if (m) return frac(+s);
  throw new Error('cannot read the ball ' + s);
}
const cmp = (a, b) => a.n * b.d - b.n * a.d;
const isWhole = (v) => v.d === 1;
const isPrime = (n) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
const isSquare = (n) => n >= 1 && Number.isInteger(Math.sqrt(n));
const label = (ball) => String(ball);
const list = (a, more = true) => a.join(', ') + (more ? ' ...' : '');
const range = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };

// ── the kinds of rule ──────────────────────────────────────────────────────────────────────────────────────────────
// each: sign (the board), say (plain words), test(v), help (Help's line), why(v, ball) -> a plain line, right or wrong
const KINDS = {
  even: () => ({
    sign: ['even numbers'], say: 'even numbers', test: (v) => isWhole(v) && v.n % 2 === 0,
    help: 'Even numbers end in 0, 2, 4, 6 or 8: they split into two equal halves.', list: list([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]),
    why: (v, b) => (isWhole(v) && v.n % 2 === 0 ? `${b} is even: it ends in ${v.n % 10}.` : `${b} is odd: it ends in ${v.n % 10}.`),
  }),
  odd: () => ({
    sign: ['odd numbers'], say: 'odd numbers', test: (v) => isWhole(v) && v.n % 2 === 1,
    help: 'Odd numbers end in 1, 3, 5, 7 or 9: one is always left over when they are split in two.', list: list([1, 3, 5, 7, 9, 11, 13, 15, 17, 19]),
    why: (v, b) => (isWhole(v) && v.n % 2 === 1 ? `${b} is odd: it ends in ${v.n % 10}.` : `${b} is even: it ends in ${v.n % 10}.`),
  }),
  less: (x) => ({
    sign: ['less than', String(x)], say: `less than ${x}`, test: (v) => cmp(v, value(x)) < 0,
    help: `Less than ${x}: smaller than ${x}, and not ${x} itself.`, list: list(range(1, Math.min(+x - 1, 10)), +x - 1 > 10),
    why: (v, b) => (cmp(v, value(x)) < 0 ? `${b} is less than ${x}.` : cmp(v, value(x)) === 0 ? `${b} is ${x} itself, not less than ${x}.` : `${b} is more than ${x}, not less.`),
  }),
  more: (x) => ({
    sign: ['more than', String(x)], say: `more than ${x}`, test: (v) => cmp(v, value(x)) > 0,
    help: `More than ${x}: bigger than ${x}, and not ${x} itself.`, list: list(range(+x + 1, +x + 8)),
    why: (v, b) => (cmp(v, value(x)) > 0 ? `${b} is more than ${x}.` : cmp(v, value(x)) === 0 ? `${b} is ${x} itself, not more than ${x}.` : `${b} is less than ${x}, not more.`),
  }),
  mult: (k) => ({
    sign: ['multiples of', String(k)], say: `multiples of ${k}`, test: (v) => isWhole(v) && v.n > 0 && v.n % k === 0,
    help: `Multiples of ${k} are the ${k} times table: ${k} × 1, ${k} × 2, ${k} × 3 and on.`, list: list(range(1, 10).map((i) => i * k)),
    why: (v, b) => {
      if (!isWhole(v) || v.n <= 0) return `${b} is not a whole number, so it is not a multiple of ${k}.`;
      const q = Math.floor(v.n / k);
      if (v.n % k === 0) return `${b} is a multiple of ${k}: ${k} × ${q} = ${b}.`;
      if (q === 0) return `${b} is not a multiple of ${k}: the first one is ${k} × 1 = ${k}.`;
      return `${b} is not a multiple of ${k}: ${k} × ${q} = ${k * q} and ${k} × ${q + 1} = ${k * (q + 1)}.`;
    },
  }),
  fact: (k) => ({
    sign: ['factors of', String(k)], say: `factors of ${k}`, test: (v) => isWhole(v) && v.n > 0 && k % v.n === 0,
    help: `Factors of ${k} divide ${k} exactly, with nothing left over.`, list: list(range(1, k).filter((i) => k % i === 0), false),
    why: (v, b) => {
      if (!isWhole(v) || v.n <= 0) return `${b} is not a whole number, so it is not a factor of ${k}.`;
      if (k % v.n === 0) return `${b} is a factor of ${k}: ${b} × ${k / v.n} = ${k}.`;
      if (v.n > k) return `${b} is bigger than ${k}, so it can't be a factor of ${k}.`;
      const q = Math.floor(k / v.n);
      return `${b} is not a factor of ${k}: ${b} × ${q} = ${v.n * q}, and ${k - v.n * q} is left over.`;
    },
  }),
  square: () => ({
    sign: ['square numbers'], say: 'square numbers', test: (v) => isWhole(v) && isSquare(v.n),
    help: 'A square number is a number times itself: 1 × 1, 2 × 2, 3 × 3 and on.', list: list(range(1, 10).map((i) => i * i)),
    why: (v, b) => {
      if (!isWhole(v)) return `${b} is not a whole number, so it is not a square number.`;
      const r = Math.floor(Math.sqrt(v.n));
      return r * r === v.n ? `${b} is a square number: ${r} × ${r} = ${b}.` : `${b} is not a square number: ${r} × ${r} = ${r * r} and ${r + 1} × ${r + 1} = ${(r + 1) * (r + 1)}.`;
    },
  }),
  prime: () => ({
    sign: ['prime numbers'], say: 'prime numbers', test: (v) => isWhole(v) && isPrime(v.n),
    help: 'A prime number has only two factors: 1 and itself. 1 is not a prime number.', list: list([2, 3, 5, 7, 11, 13, 17, 19, 23, 29]),
    why: (v, b) => {
      if (!isWhole(v)) return `${b} is not a whole number, so it is not prime.`;
      if (v.n === 1) return '1 is not a prime number: a prime has exactly two factors.';
      if (isPrime(v.n)) return `${b} is prime: only 1 and ${b} divide it.`;
      let f = 2; while (v.n % f) f++;
      return `${b} is not prime: ${f} × ${v.n / f} = ${b}.`;
    },
  }),
  tens: (k) => ({
    sign: [`${k} tens`], say: `${k} tens (${k}0 to ${k}9)`, test: (v) => isWhole(v) && Math.floor(v.n / 10) === k && v.n < 100,
    help: `${k} tens: the numbers from ${k}0 to ${k}9.`, list: list(range(k * 10, k * 10 + 9), false),
    why: (v, b) => (Math.floor(v.n / 10) === k ? `${b} has ${k} tens.` : `${b} has ${Math.floor(v.n / 10)} tens, not ${k}.`),
  }),
  ones: (k) => ({
    sign: [`${k} ones`], say: `${k} ones (ends in ${k})`, test: (v) => isWhole(v) && v.n % 10 === k,
    help: `${k} ones: the numbers that end in ${k}.`, list: list(range(0, 9).map((i) => i * 10 + k).filter((x) => x > 0)),
    why: (v, b) => (v.n % 10 === k ? `${b} ends in ${k}.` : `${b} ends in ${v.n % 10}, not ${k}.`),
  }),
};

const CACHE = new Map();
export function ruleOf(name) {
  if (name && typeof name === 'object') return name;
  if (CACHE.has(name)) return CACHE.get(name);
  const [kind, arg] = String(name).split(':'), K = KINDS[kind];
  if (!K) throw new Error('Mathball: no rule called ' + name);
  const x = arg == null ? undefined : /^\d+$/.test(arg) ? +arg : arg;
  if (['less', 'more', 'mult', 'fact', 'tens', 'ones'].includes(kind) && x == null) throw new Error('Mathball: the rule ' + name + ' needs a number');
  const r = K(x), rule = { id: String(name), kind, arg: x, ...r, why: (ball) => r.why(value(ball), label(ball)) };
  CACHE.set(name, rule);
  return rule;
}
export const fits = (rule, ball) => ruleOf(rule).test(value(ball));
// the goals a ball fits (their indexes)
export const goalsFor = (rules, ball) => rules.map((r, i) => (fits(r, ball) ? i : -1)).filter((i) => i >= 0);
// a ball's number as it is written on the ball
export const ballText = (ball) => String(ball);

// ── THE BALL CHECK ─────────────────────────────────────────────────────────────────────────────────────────────────
// every ball must fit at least one goal and never every goal; every goal must take at least `per` of the balls
export function checkSet(rules, balls, { per = 2 } = {}) {
  const R = rules.map(ruleOf);
  const rows = balls.map((b) => { const hit = R.map((r) => fits(r, b)); return { ball: b, hit, n: hit.filter(Boolean).length }; });
  const each = R.map((r, i) => rows.filter((w) => w.hit[i]).length);
  const none = rows.filter((w) => w.n === 0).map((w) => w.ball), every = rows.filter((w) => w.n === R.length).map((w) => w.ball);
  const dead = R.filter((r, i) => each[i] < per).map((r) => r.say);
  return { ok: !none.length && !every.length && !dead.length, none, every, dead, each, choice: rows.filter((w) => w.n >= 2).length, rows };
}
// the balls of a pool that may be dealt with these rules: each fits at least one goal, never every goal
export const dealable = (rules, pool) => pool.filter((b) => { const n = goalsFor(rules, b).length; return n >= 1 && n < rules.length; });

// ── A GOAL'S RULE CHANGING ─────────────────────────────────────────────────────────────────────────────────────────
// The light bar reaches goal `at`: its rule changes to one of the rung's rules not on a goal now. Before it changes,
// the game checks the balls really on the court (ARENA.md: "only the eight or so balls on the court at that moment need a
// goal, so the game picks a change that suits them"):
//   - a ball in someone's hand must still fit a goal and not every goal (never changed under a player's feet);
//   - every ball on the court should too; and every goal should take at least one of them (no dead goal);
//   - the pool must still be able to deal balls for every goal (so new balls can come for the new rule).
// The best change keeps all of that. If none can (the goal holds the only rule some balls fit), the change that leaves
// the fewest balls with nowhere to go is made, and those balls are swapped out (they fade, new ones come in): `strand`.
//   -> { rule (its name), rules (the goals after), strand: [balls that fit no goal or every goal], safe }  or null
export function pickChange(rules, at, pool, balls, { held = [], rand = Math.random, spares = [] } = {}) {
  const now = rules.map((r) => ruleOf(r).id);
  const tryAll = (cands) => {
    let best = null;
    for (const id of cands) {
      const next = now.map((r, i) => (i === at ? id : r));
      const bad = (b) => { const n = goalsFor(next, b).length; return n === 0 || n === next.length; };
      if (held.some(bad)) continue;                                   // (never under a player's feet)
      const strand = balls.filter(bad), keep = balls.filter((b) => !bad(b));
      const deal = dealable(next, pool), dead = next.filter((r) => !deal.some((b) => fits(r, b))).length;
      if (dead) continue;                                              // (the pool could never feed some goal)
      const empty = next.filter((r) => !keep.some((b) => fits(r, b))).length;   // (goals no ball on the court fits now)
      const choice = keep.filter((b) => goalsFor(next, b).length >= 2).length;
      const score = strand.length * 10 + empty * 3 - choice * 0.5 + rand() * 0.9;
      if (!best || score < best.score) best = { rule: id, rules: next, strand, safe: !strand.length, score };
    }
    return best;
  };
  const own = [...new Set(spares.map((r) => ruleOf(r).id))].filter((id) => !now.includes(id));
  // (a ball in someone's hand that every rule of the set would leave with no goal, or with every goal: a plainer rule is
  // made for the change, by the nearest round numbers either side of it ("more than 20", "less than 30" take it; "less
  // than 70", "more than 80" leave it out), or odd or even)
  let best = tryAll(own);
  if (!best && held.length) {
    const vs = held.map(value).map((v) => v.n / v.d), lo = Math.min(...vs), hi = Math.max(...vs), gen = ['odd', 'even'];
    for (const step of [5, 10]) {
      const below = Math.floor((lo - 0.001) / step) * step, above = Math.ceil((hi + 0.001) / step) * step;
      if (below > 0) gen.push('more:' + below, 'less:' + below);
      gen.push('less:' + above, 'more:' + above);
    }
    best = tryAll([...new Set(gen)].filter((id) => !now.includes(id)));
  }
  return best;
}
