// MATHBALL'S GOAL RULES: what a goal's sign says and which balls it takes. Plain numbers and words (no three.js, no
// page), so the game, the lab (labs/mathball/) and node (pi-nebula/tests/mathball.test.mjs) all read the same rules.
// From round three's rules (the game's maker's own idea, 2026-11-16: "there could be a goal that said factors of 24,
// and there could be one that says multiples of 8. So the 8 ball could go in either").
//
//   ruleOf('mult:3')          one rule from its short name (the ladder writes rules this way): { id, sign: [words,
//                             number?] (the board: the words small over the number big), say (plain words), takes
//                             (what a goal with it takes, where say is not a noun: "numbers that round to 3"), test(v),
//                             help (one plain line for Help), list (examples), why(ball) (why a ball fits or doesn't) }
//                             names: even, odd, less:N, more:N, mult:N, fact:N, square, prime, cube, tens:N, ones:N,
//                             and for fraction and decimal balls eq:N (equal to), between:A:B, round:N (rounds to N);
//                             N may be a fraction or a decimal: 'more:1/2', 'eq:3/4', 'less:1.5'
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
  // (how it is written goes with it: a fraction or a decimal that comes to a whole number, 4/4, is still written as one)
  let m = s.match(/^(\d+)\/(\d+)$/); if (m) return { ...frac(+m[1], +m[2]), w: 'frac' };
  m = s.match(/^(\d*)\.(\d+)$/); if (m) return { ...frac(+(m[1] || 0) * 10 ** m[2].length + +m[2], 10 ** m[2].length), w: 'dec' };
  m = s.match(/^\d+$/); if (m) return frac(+s);
  throw new Error('cannot read the ball ' + s);
}
const cmp = (a, b) => a.n * b.d - b.n * a.d;
const isWhole = (v) => v.d === 1;
// a ball WRITTEN as a whole number: the whole-number rules (odd and even, multiples, factors, squares, primes, cubes)
// take only these. 4/4 is 1, but a child sees a fraction: it goes in "equal to 1", not in "factors of 48"
const wholeBall = (v) => isWhole(v) && v.w !== 'frac' && v.w !== 'dec';
const notWhole = (v, b, tail) => (isWhole(v) ? `${b} is ${v.n} written as a ${v.w === 'dec' ? 'decimal' : 'fraction'}, and this goal takes whole numbers.` : `${b} is not a whole number, so ${tail}.`);
const isPrime = (n) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
const isSquare = (n) => n >= 1 && Number.isInteger(Math.sqrt(n));
const label = (ball) => String(ball);
const list = (a, more = true) => a.join(', ') + (more ? ' ...' : '');
const range = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };

// ── fractions and decimals (balls written '3/4', '0.75') ───────────────────────────────────────────────────────────
const isFrac = (s) => /^\d+\/\d+$/.test(String(s));
const isDec = (s) => /^\d*\.\d+$/.test(String(s));
const lcm = (a, b) => a / gcd(a, b) * b;
// a value as a decimal, when it is a short one (1/2 is 0.5, 3/4 is 0.75), else null
const decOf = (v) => { const x = v.n / v.d, s = String(Math.round(x * 1000) / 1000); return Math.abs(+s - x) < 1e-9 && s.length <= 5 ? s : null; };
// the examples Help shows for a rule about fractions or decimals (its own kind of ball first)
const FRACS = ['1/2', '2/4', '3/6', '5/10', '1/3', '1/4', '1/5', '1/8', '2/3', '3/4', '2/5', '3/5', '4/5', '3/8', '5/8', '7/8', '2/8', '6/8', '4/4', '3/3'];
const DECS = ['0.25', '0.3', '0.5', '0.6', '0.75', '0.8', '1.2', '1.4', '1.6', '1.8', '2.2', '2.4', '2.6', '2.7', '2.8', '3.1', '3.2', '3.4', '3.6', '3.8', '4.2'];
const NAMES = { '1/4': 'one quarter', '3/4': 'three quarters', '1/3': 'one third', '2/3': 'two thirds' };
const PARTS = { 2: ['half', 'halves'], 3: ['third', 'thirds'], 4: ['quarter', 'quarters'], 5: ['fifth', 'fifths'], 6: ['sixth', 'sixths'], 8: ['eighth', 'eighths'], 10: ['tenth', 'tenths'], 12: ['twelfth', 'twelfths'] };
const examplesOf = (test, kinds, n = 6) => { const a = kinds.flat().filter((b) => test(value(b))); return list(a.slice(0, n), a.length > n); };
// why a ball b (value v) is more than, less than or the same as x: one short reason, in the ball's own kind of number,
// in plain words a nine-year-old reads ("1.5 is less than 2", "7 tenths is more than 5 tenths")
function against(v, b, x) {
  const X = value(x), c = cmp(v, X), word = c === 0 ? 'the same as' : c > 0 ? 'more than' : 'less than', so = c === 0 ? 'the same' : c > 0 ? 'more' : 'less';
  if (isFrac(b) && X.n * 2 === X.d) {
    // (against one half: the top number against half the bottom one)
    const [n, d] = String(b).split('/').map(Number), h = d / 2, hs = Number.isInteger(h) ? String(h) : `${Math.floor(h)} and a half`;
    return c === 0 ? `${n} is half of ${d}` : `half of ${d} is ${hs}, and ${n} is ${so}`;
  }
  if (isFrac(b) && String(x) === '1' && c !== 0) {
    // (against one whole: the top number against the bottom one)
    const [n, d] = String(b).split('/').map(Number);
    return `the top number, ${n}, is ${so} than the bottom one, ${d}: ${so} than one whole`;
  }
  if (isFrac(b) && isFrac(x)) {
    // (the same size of parts: the bottom numbers made the same)
    const [n, d] = String(b).split('/').map(Number), [p, q] = String(x).split('/').map(Number), D = lcm(d, q);
    if (d === q && PARTS[d]) return `${n} ${PARTS[d][n === 1 ? 0 : 1]} is ${word} ${p} ${PARTS[d][p === 1 ? 0 : 1]}`;
    if (d === q) return `${n} parts is ${word} ${p} parts of the same size`;
    if (n === p) return `${n === 1 ? '' : `both have ${n} parts, and `}cut into ${d}, the parts are ${d > q ? 'smaller' : 'bigger'} than cut into ${q}`;
    if (d === D) return `${x} is ${p * D / q}/${D}, and ${b} is ${so}`;
    if (q === D) return `${b} is ${n * D / d}/${D}, ${word} ${x}`;
    return `${b} is ${n * D / d}/${D} and ${x} is ${p * D / q}/${D}`;
  }
  // (a decimal on either side: the whole numbers first, then the tenths, then the hundredths)
  if (isDec(b) || isDec(x)) {
    const asDec = (t, w) => (isDec(t) || /^\d+$/.test(String(t)) ? String(t) : decOf(w));
    const bd = asDec(b, v), xd = asDec(x, X), bw = Math.floor(v.n / v.d), xw = Math.floor(X.n / X.d), PL = ['tenths', 'hundredths', 'thousandths'];
    const unit = (n, i) => (+n === 1 ? PL[i].slice(0, -1) : PL[i]);     // (1 tenth, 5 tenths)
    // (a fraction said as its decimal first, when it has a short one: 2/4 is 0.5)
    const Bs = isFrac(b) && bd ? `${b} is ${bd}` : String(b), Xs = isFrac(x) && xd ? `${x} is ${xd}` : String(x);
    const is = (s, t) => (s !== String(t) ? `${s},` : `${s} is`);
    // the whole numbers differ, and that decides it (0.4 and 1.5: 0.4 is less than 1; 21 and 1.5: 1.5 is less than 2)
    if (bw < xw) return `${is(Bs, b)} less than ${xw}`;
    if (bw > xw) return `${is(Xs, x)} less than ${xw + 1}`;
    if (!bd || !xd) return `${b} is ${word} ${x}`;
    const bf = bd.split('.')[1] || '', xf = xd.split('.')[1] || '', L = Math.max(bf.length, xf.length);
    const lead = isFrac(b) ? Bs + ', and ' : isFrac(x) ? Xs + ', and ' : '';
    // (the same whole number, one of them with no tenths: the other said as its whole and its tenths: 1.5 is 1 and 5
    // tenths)
    if (!bf || !xf) { const [s, f] = bf ? [bd, bf] : [xd, xf]; return `${lead}${s} is ${bw} and ${+f} ${unit(f, f.length - 1)}`; }
    const P = bf.padEnd(L, '0'), Q = xf.padEnd(L, '0');
    for (let i = 0; i < L; i++) if (P[i] !== Q[i]) return `${lead}${i ? 'the same tenths, then ' : ''}${P[i]} ${unit(P[i], i)} is ${P[i] > Q[i] ? 'more' : 'less'} than ${Q[i]} ${unit(Q[i], i)}`;
    return lead ? lead.slice(0, -', and '.length) : 'the same';
  }
  if (isWhole(v) && !isWhole(X)) return `${b} is a whole number, ${word} ${x}`;
  return `${b} is ${word} ${x}`;
}
// the nearest whole number (a half rounds up)
const nearest = (v) => Math.floor((2 * v.n + v.d) / (2 * v.d));
const isCube = (n) => n >= 1 && Math.round(Math.cbrt(n)) ** 3 === n;

// ── the kinds of rule ──────────────────────────────────────────────────────────────────────────────────────────────
// each: sign (the board), say (plain words), test(v), help (Help's line), why(v, ball) -> a plain line, right or wrong
const KINDS = {
  even: () => ({
    sign: ['even numbers'], say: 'even numbers', test: (v) => wholeBall(v) && v.n % 2 === 0,
    help: 'Even numbers end in 0, 2, 4, 6 or 8: they split into two equal halves.', list: list([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]),
    why: (v, b) => (!wholeBall(v) ? notWhole(v, b, 'it is not even or odd: only whole numbers are') : v.n % 2 === 0 ? `${b} is even: it ends in ${v.n % 10}.` : `${b} is odd: it ends in ${v.n % 10}.`),
  }),
  odd: () => ({
    sign: ['odd numbers'], say: 'odd numbers', test: (v) => wholeBall(v) && v.n % 2 === 1,
    help: 'Odd numbers end in 1, 3, 5, 7 or 9: one is always left over when they are split in two.', list: list([1, 3, 5, 7, 9, 11, 13, 15, 17, 19]),
    why: (v, b) => (!wholeBall(v) ? notWhole(v, b, 'it is not odd or even: only whole numbers are') : v.n % 2 === 1 ? `${b} is odd: it ends in ${v.n % 10}.` : `${b} is even: it ends in ${v.n % 10}.`),
  }),
  // (less and more than a whole number; or, for fraction and decimal balls, than a fraction or a decimal: 'more:1/2')
  less: (x) => ({
    sign: ['less than', String(x)], say: `less than ${x}`, takes: `numbers less than ${x}`, test: (v) => cmp(v, value(x)) < 0,
    help: isFrac(x) && value(x).n * 2 === value(x).d ? 'Less than 1/2: the top number is less than half the bottom number (1/3: half of 3 is 1 and a half, and 1 is less).'
      : isFrac(x) && value(x).n === 1 ? `Less than ${x}: a smaller part than ${x}. 1/${value(x).d + 1} and 1/${value(x).d * 2} are smaller: the more parts a whole is cut into, the smaller each part.`
      : !isWhole(value(x)) ? `Less than ${x}: smaller than ${x}, and not ${x} itself.${isFrac(x) && decOf(value(x)) ? ` (${x} is ${decOf(value(x))}.)` : ''}`
        : `Less than ${x}: smaller than ${x}, and not ${x} itself.`,
    list: !isWhole(value(x)) ? examplesOf((v) => cmp(v, value(x)) < 0, isDec(x) ? [DECS, FRACS] : [FRACS, DECS]) : list(range(1, Math.min(+x - 1, 10)), +x - 1 > 10),
    why: (v, b) => {
      if (cmp(v, value(x)) === 0 && String(b) === String(x)) return `${b} is ${x} itself, not less than ${x}.`;
      if (!isWhole(v) || !isWhole(value(x))) return cmp(v, value(x)) < 0 ? `${b} is less than ${x}: ${against(v, b, x)}.` : `${b} is not less than ${x}: ${against(v, b, x)}.`;
      return cmp(v, value(x)) < 0 ? `${b} is less than ${x}.` : cmp(v, value(x)) === 0 ? `${b} is ${x} itself, not less than ${x}.` : `${b} is more than ${x}, not less.`;
    },
  }),
  more: (x) => ({
    sign: ['more than', String(x)], say: `more than ${x}`, takes: `numbers more than ${x}`, test: (v) => cmp(v, value(x)) > 0,
    help: isFrac(x) && value(x).n * 2 === value(x).d ? 'More than 1/2: the top number is more than half the bottom number (3/4: half of 4 is 2, and 3 is more).'
      : !isWhole(value(x)) ? `More than ${x}: bigger than ${x}, and not ${x} itself.${isFrac(x) && decOf(value(x)) ? ` (${x} is ${decOf(value(x))}.)` : ''}`
        : `More than ${x}: bigger than ${x}, and not ${x} itself.`,
    list: !isWhole(value(x)) ? examplesOf((v) => cmp(v, value(x)) > 0 && v.n / v.d < 5, isDec(x) ? [DECS, FRACS] : [FRACS, DECS]) : list(range(+x + 1, +x + 8)),
    why: (v, b) => {
      if (cmp(v, value(x)) === 0 && String(b) === String(x)) return `${b} is ${x} itself, not more than ${x}.`;
      if (!isWhole(v) || !isWhole(value(x))) return cmp(v, value(x)) > 0 ? `${b} is more than ${x}: ${against(v, b, x)}.` : `${b} is not more than ${x}: ${against(v, b, x)}.`;
      return cmp(v, value(x)) > 0 ? `${b} is more than ${x}.` : cmp(v, value(x)) === 0 ? `${b} is ${x} itself, not more than ${x}.` : `${b} is less than ${x}, not more.`;
    },
  }),
  // EQUAL TO a fraction, a decimal or 1: the same amount, however it is written (2/4, 3/6 and 0.5 are all 1/2)
  eq: (x) => ({
    sign: ['equal to', String(x)], say: `equal to ${x}`, takes: `numbers equal to ${x}`, test: (v) => cmp(v, value(x)) === 0,
    help: String(x) === '1' ? 'Equal to 1: one whole. The top number and the bottom number are the same (3/3, 4/4).'
      : isFrac(x) && value(x).n * 2 === value(x).d ? `Equal to 1/2: one half. The top number is exactly half the bottom number (2/4, 3/6, 5/10), and 0.5 is a half too.`
        : `Equal to ${x}${NAMES[String(x)] ? `, ${NAMES[String(x)]}` : ''}: the same amount, however it is written (${examplesOf((v) => cmp(v, value(x)) === 0, [FRACS, DECS], 3).replace(' ...', '')}).`,
    list: examplesOf((v) => cmp(v, value(x)) === 0, [FRACS, DECS]),
    why: (v, b) => {
      const X = value(x);
      if (cmp(v, X) === 0) {
        if (String(b) === String(x)) return `${b} is equal to ${x}.`;
        if (String(x) === '1' && isFrac(b)) return `${b} is equal to 1: the top and the bottom are the same.`;
        if (isFrac(b) && X.n * 2 === X.d) return `${b} is equal to 1/2: ${against(v, b, x)}.`;
        if (isFrac(b)) { const [n, d] = String(b).split('/').map(Number), k = n / X.n; return `${b} is equal to ${x}: ${n} ÷ ${k} = ${X.n} and ${d} ÷ ${k} = ${X.d}.`; }
        return `${b} is equal to ${x}: ${decOf(X) && !isDec(x) ? `${x} is ${decOf(X)}` : `${b} is ${x} written another way`}.`;
      }
      return `${b} is not equal to ${x}: ${against(v, b, x)}.`;
    },
  }),
  // BETWEEN two numbers (more than the first and less than the second): 'between:0:1' takes 0.3 and 2/3, not 1
  between: (a, b) => ({
    sign: ['between', `${a} and ${b}`], say: `between ${a} and ${b}`, takes: `numbers between ${a} and ${b}`, test: (v) => cmp(v, value(a)) > 0 && cmp(v, value(b)) < 0,
    help: `Between ${a} and ${b}: more than ${a} and less than ${b}${String(a) === '0' && String(b) === '1' ? ': a part of one, less than a whole (0.3, 0.75, 2/3)' : ''}.`,
    list: examplesOf((v) => cmp(v, value(a)) > 0 && cmp(v, value(b)) < 0, isFrac(a) || isFrac(b) ? [FRACS, DECS] : [DECS, FRACS]),
    why: (v, B) => (cmp(v, value(a)) > 0 && cmp(v, value(b)) < 0 ? `${B} is between ${a} and ${b}: more than ${a}, less than ${b}.`
      : cmp(v, value(b)) >= 0 ? `${B} is ${cmp(v, value(b)) === 0 ? b + ' itself' : 'more than ' + b}, not between ${a} and ${b}.` : `${B} is ${cmp(v, value(a)) === 0 ? a + ' itself' : 'less than ' + a}, not between ${a} and ${b}.`),
  }),
  // ROUNDS TO a whole number: its nearest whole number (the tenths: 5 or more rounds up)
  round: (k) => ({
    sign: ['rounds to', String(k)], say: `rounds to ${k}`, takes: `numbers that round to ${k}`, test: (v) => nearest(v) === +k,
    help: `Rounds to ${k}: ${k} is the nearest whole number. Look at the tenths: 5 or more rounds up (${+k - 1}.6 rounds up to ${k}), under 5 rounds down (${k}.3 rounds down to ${k}).`,
    list: examplesOf((v) => nearest(v) === +k && !isWhole(v) && (2 * v.n) % v.d !== 0, [DECS]),
    why: (v, b) => {
      const r = nearest(v), s = String(b), t = isDec(s) ? +s.split('.')[1][0] : null;
      const how = isWhole(v) ? `${b} is a whole number already` : t != null ? `the first digit after the point, ${t}, is ${t >= 5 ? '5 or more, so it rounds up' : 'under 5, so it rounds down'}` : `the nearest whole number is ${r}`;
      return r === +k ? `${b} rounds to ${k}: ${how}.` : `${b} rounds to ${r}, not ${k}: ${how}.`;
    },
  }),
  cube: () => ({
    sign: ['cube numbers'], say: 'cube numbers', test: (v) => wholeBall(v) && isCube(v.n),
    help: 'A cube number is a number times itself, and times itself again: 2 × 2 × 2 = 8, 3 × 3 × 3 = 27.', list: list([1, 8, 27, 64, 125], false),
    why: (v, b) => {
      if (!wholeBall(v)) return notWhole(v, b, 'it is not a cube number');
      const r = Math.round(Math.cbrt(v.n));
      if (r ** 3 === v.n) return `${b} is a cube number: ${r} × ${r} × ${r} = ${b}.`;
      const lo = Math.floor(Math.cbrt(v.n) + 1e-9);
      return `${b} is not a cube number: ${lo} × ${lo} × ${lo} = ${lo ** 3} and ${lo + 1} × ${lo + 1} × ${lo + 1} = ${(lo + 1) ** 3}.`;
    },
  }),
  mult: (k) => ({
    sign: ['multiples of', String(k)], say: `multiples of ${k}`, test: (v) => wholeBall(v) && v.n > 0 && v.n % k === 0,
    help: `Multiples of ${k} are the ${k} times table: ${k} × 1, ${k} × 2, ${k} × 3 and on.`, list: list(range(1, 10).map((i) => i * k)),
    why: (v, b) => {
      if (!wholeBall(v) || v.n <= 0) return notWhole(v, b, `it is not a multiple of ${k}`);
      const q = Math.floor(v.n / k);
      if (v.n % k === 0) return `${b} is a multiple of ${k}: ${k} × ${q} = ${b}.`;
      if (q === 0) return `${b} is not a multiple of ${k}: the first one is ${k} × 1 = ${k}.`;
      return `${b} is not a multiple of ${k}: ${k} × ${q} = ${k * q} and ${k} × ${q + 1} = ${k * (q + 1)}.`;
    },
  }),
  fact: (k) => ({
    sign: ['factors of', String(k)], say: `factors of ${k}`, test: (v) => wholeBall(v) && v.n > 0 && k % v.n === 0,
    help: `Factors of ${k} divide ${k} exactly, with nothing left over.`, list: list(range(1, k).filter((i) => k % i === 0), false),
    why: (v, b) => {
      if (!wholeBall(v) || v.n <= 0) return notWhole(v, b, `it is not a factor of ${k}`);
      if (k % v.n === 0) return `${b} is a factor of ${k}: ${b} × ${k / v.n} = ${k}.`;
      if (v.n > k) return `${b} is bigger than ${k}, so it can't be a factor of ${k}.`;
      const q = Math.floor(k / v.n);
      return `${b} is not a factor of ${k}: ${b} × ${q} = ${v.n * q}, and ${k - v.n * q} is left over.`;
    },
  }),
  square: () => ({
    sign: ['square numbers'], say: 'square numbers', test: (v) => wholeBall(v) && isSquare(v.n),
    help: 'A square number is a number times itself: 1 × 1, 2 × 2, 3 × 3 and on.', list: list(range(1, 10).map((i) => i * i)),
    why: (v, b) => {
      if (!wholeBall(v)) return notWhole(v, b, 'it is not a square number');
      const r = Math.floor(Math.sqrt(v.n));
      return r * r === v.n ? `${b} is a square number: ${r} × ${r} = ${b}.` : `${b} is not a square number: ${r} × ${r} = ${r * r} and ${r + 1} × ${r + 1} = ${(r + 1) * (r + 1)}.`;
    },
  }),
  prime: () => ({
    sign: ['prime numbers'], say: 'prime numbers', test: (v) => wholeBall(v) && isPrime(v.n),
    help: 'A prime number has only two factors: 1 and itself. 1 is not a prime number.', list: list([2, 3, 5, 7, 11, 13, 17, 19, 23, 29]),
    why: (v, b) => {
      if (!wholeBall(v)) return notWhole(v, b, 'it is not prime');
      if (v.n === 1) return '1 is not a prime number: a prime has exactly two factors.';
      if (isPrime(v.n)) return `${b} is prime: only 1 and ${b} divide it.`;
      let f = 2; while (v.n % f) f++;
      return `${b} is not prime: ${f} × ${v.n / f} = ${b}.`;
    },
  }),
  tens: (k) => ({
    sign: [`${k} tens`], say: `${k} tens (${k}0 to ${k}9)`, test: (v) => wholeBall(v) && Math.floor(v.n / 10) === k && v.n < 100,
    help: `${k} tens: the numbers from ${k}0 to ${k}9.`, list: list(range(k * 10, k * 10 + 9), false),
    why: (v, b) => (Math.floor(v.n / 10) === k ? `${b} has ${k} tens.` : `${b} has ${Math.floor(v.n / 10)} tens, not ${k}.`),
  }),
  ones: (k) => ({
    sign: [`${k} ones`], say: `${k} ones (ends in ${k})`, test: (v) => wholeBall(v) && v.n % 10 === k,
    help: `${k} ones: the numbers that end in ${k}.`, list: list(range(0, 9).map((i) => i * 10 + k).filter((x) => x > 0)),
    why: (v, b) => (v.n % 10 === k ? `${b} ends in ${k}.` : `${b} ends in ${v.n % 10}, not ${k}.`),
  }),
};

const CACHE = new Map();
export function ruleOf(name) {
  if (name && typeof name === 'object') return name;
  if (CACHE.has(name)) return CACHE.get(name);
  const [kind, arg, arg2] = String(name).split(':'), K = KINDS[kind];
  if (!K) throw new Error('Mathball: no rule called ' + name);
  const num = (a) => (a == null ? undefined : /^\d+$/.test(a) ? +a : a), x = num(arg), y = num(arg2);
  if (['less', 'more', 'mult', 'fact', 'tens', 'ones', 'eq', 'round'].includes(kind) && x == null) throw new Error('Mathball: the rule ' + name + ' needs a number');
  if (kind === 'between' && (x == null || y == null)) throw new Error('Mathball: the rule ' + name + ' needs two numbers');
  for (const a of [x, y]) if (a != null) value(a);   // (a number the balls' check can't read: a mistake in the ladder)
  const r = K(x, y), rule = { id: String(name), kind, arg: x, arg2: y, ...r, why: (ball) => r.why(value(ball), label(ball)) };
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
// NO CATCH-ALL GOAL, NO TWO GOALS ALIKE: what is wrong with four goals over the balls a pool would deal them: the goals
// that take more than BROAD of those balls (on a court of fractions and whole numbers, "more than 1/2" takes every whole
// number: no choice is left), and the pairs that take exactly the same balls ("even numbers" and "multiples of 2")
// A rule for fraction and decimal balls (equal to, between, rounds to, more or less than a fraction or a decimal) that
// takes most of the whole-number balls is a catch-all too: "more than 2.5" beside "factors of 36" takes nearly every
// whole number
export const BROAD = 0.75, BROAD_WHOLE = 0.5;
const forFractions = (r) => { const R = ruleOf(r); return ['eq', 'between', 'round'].includes(R.kind) || (['less', 'more'].includes(R.kind) && !isWhole(value(R.arg))); };
export function crowded(rules, pool) {
  const deal = dealable(rules, pool), fit = rules.map((r) => deal.map((b) => fits(r, b)));
  const wholes = deal.map((b) => /^\d+$/.test(String(b)));
  const nWhole = wholes.filter(Boolean).length;
  const broad = rules.filter((r, i) => (deal.length >= 4 && fit[i].filter(Boolean).length > BROAD * deal.length)
    || (nWhole >= 4 && forFractions(r) && fit[i].filter((x, k) => x && wholes[k]).length > BROAD_WHOLE * nWhole)).map((r) => ruleOf(r).id);
  const alike = [];
  for (let i = 0; i < rules.length; i++) for (let j = i + 1; j < rules.length; j++) if (deal.length && fit[i].every((x, k) => x === fit[j][k])) alike.push([ruleOf(rules[i]).id, ruleOf(rules[j]).id]);
  return { broad, alike, deal };
}

// ── A GOAL'S RULE CHANGING ─────────────────────────────────────────────────────────────────────────────────────────
// The light bar reaches goal `at`: its rule changes to one of the rung's rules not on a goal now. Before it changes,
// the game checks the balls really on the court (ARENA.md: "only the eight or so balls on the court at that moment need a
// goal, so the game picks a change that suits them"):
//   - a ball in someone's hand must still fit a goal and not every goal (never changed under a player's feet);
//   - every ball on the court should too; and every goal should take at least one of them (no dead goal);
//   - the pool must still be able to deal balls for every goal (so new balls can come for the new rule).
// The best change keeps all of that. If none can (the goal holds the only rule some balls fit), the change that leaves
// the fewest balls with nowhere to go is made, and those balls are swapped out (they fade, new ones come in): `strand`.
// Among good changes, the rung's own rules (`theme`: a level's own rule set) come back first when one is free, so the
// round stays on its subject (on the first rung, even and odd move from goal to goal rather than leaving the court for
// good). A change that would make a catch-all goal or two goals alike (crowded, above) is the last resort.
//   plain: a plainer rule may be made for a held ball nothing else suits (more or less than a round number, odd or
//   even); false on the levels past those (the game's maker: "Any kind of more than or less than is way easier than
//   multiples and factors"): there it is a multiple or a factor that takes the ball
//   -> { rule (its name), rules (the goals after), strand: [balls that fit no goal or every goal], safe }  or null
//   wait: true -> null rather than a catch-all goal or two alike made only to keep a ball in a hand (the game tries the
//   change again once that ball is thrown: game.js change)
export function pickChange(rules, at, pool, balls, { held = [], rand = Math.random, spares = [], theme = [], plain = true, wait = false } = {}) {
  const now = rules.map((r) => ruleOf(r).id), home = theme.map((r) => ruleOf(r).id);
  let clean = 0, cleanFree = 0;   // (changes with no catch-all goal: keeping the held ball; and leaving it out)
  const tryAll = (cands) => {
    let best = null;
    for (const id of cands) {
      const next = now.map((r, i) => (i === at ? id : r));
      const bad = (b) => { const n = goalsFor(next, b).length; return n === 0 || n === next.length; };
      const C = crowded(next, pool), deal = C.deal, dead = next.filter((r) => !deal.some((b) => fits(r, b))).length;
      if (dead) continue;                                              // (the pool could never feed some goal)
      const crowd = C.broad.length + C.alike.length; if (!crowd) cleanFree++;
      if (held.some(bad)) continue;                                   // (never under a player's feet)
      if (!crowd) clean++;
      const strand = balls.filter(bad), keep = balls.filter((b) => !bad(b));
      const empty = next.filter((r) => !keep.some((b) => fits(r, b))).length;   // (goals no ball on the court fits now)
      const choice = keep.filter((b) => goalsFor(next, b).length >= 2).length;
      const score = strand.length * 10 + empty * 3 - choice * 0.5 - (home.includes(id) ? 2 : 0) + crowd * 40 + rand() * 0.9;
      if (!best || score < best.score) best = { rule: id, rules: next, strand, safe: !strand.length, score, crowd };
    }
    return best;
  };
  const own = [...new Set(spares.map((r) => ruleOf(r).id))].filter((id) => !now.includes(id));
  // (a ball in someone's hand that every rule of the set would leave with no goal, or with every goal: a rule is made for
  // the change that takes it. A whole number: on the first levels by the nearest round numbers either side of it ("more
  // than 20", "less than 30" take it; "less than 70", "more than 80" leave it out), or odd or even; past them a multiple
  // of one of its factors, or the factors of a number it divides. A fraction or a decimal: more or less than a half, a
  // whole number or a round half)
  let best = tryAll(own);
  // (a fraction or a decimal in a hand that no rule of the level could keep: the change waits for the throw, rather
  // than a rule from outside the level's sets)
  if (!best && wait && held.some((b) => /[/.]/.test(String(b)))) return null;
  if (!best && held.length) {
    const V = held.map(value), vs = V.map((v) => v.n / v.d), lo = Math.min(...vs), hi = Math.max(...vs), gen = [];
    if (V.every((v) => v.d === 1)) {
      if (plain) {
        gen.push('odd', 'even');
        for (const step of [5, 10]) {
          const below = Math.floor((lo - 0.001) / step) * step, above = Math.ceil((hi + 0.001) / step) * step;
          if (below > 0) gen.push('more:' + below, 'less:' + below);
          gen.push('less:' + above, 'more:' + above);
        }
      } else {
        for (const v of V) {
          for (let k = 2; k <= 12; k++) if (v.n % k === 0 && v.n > k) gen.push('mult:' + k);
          for (const m of [12, 24, 30, 36, 40, 48, 60, 72, 84, 90, 96, 100]) if (m % v.n === 0 && m > v.n) gen.push('fact:' + m);
        }
      }
    } else {
      for (const x of ['1/2', '1', '1.5', '2.5', '3.5']) gen.push('more:' + x, 'less:' + x);
    }
    best = tryAll([...new Set(gen)].filter((id) => !now.includes(id)));
  }
  // (every change that keeps the held ball makes a catch-all or two goals alike: better to wait for the throw)
  if (best && best.crowd && !clean && cleanFree && wait && held.length) return null;
  return best;
}
