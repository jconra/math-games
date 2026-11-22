// THE SENSORS' CARD: the wreck found on arrival, a math card with coordinates (the game's maker, 2026-11-22, RESC1-3:
// "We could do a math question with coordinates when you first start that shows you relative to the target, so it is
// representing you finding the target with sensors, and then you travel to it."). One card as the ship comes out over
// the planet, in the jump computer's dark look: a grid with the ship at its middle, nose up the screen, and the wreck
// where the sensors have found it. Answered, the way there lights up (src/planet/guide.js: the beam, the arrow, the
// radar's dot) and the ship flies to it.
//
// THE CARD IS TRUE: the ship is put where the card says it is (each square of the grid is SQUARE metres of the ground,
// across to its right and ahead of its nose), so the number answered is the way the ship then flies. Its facts:
// { x (squares to the right; minus, to the left), y (squares ahead; minus, behind), unit (metres a square) }.
//
// THE LADDER, easiest first, each on Mathwood's school guide (0 starting kindergarten ... 80 eighth grade), as the
// other jobs' are: whole numbers on a grid for the youngest, then negatives, then distances.
//   1  Squares to the wreck (4): straight ahead or straight across, up to 5 squares: count them
//   2  Across, then ahead (18): (3, 2), up to 5 each way, the wreck ahead and to the right
//   3  Up to nine (30): the same up to 9
//   4  Squares into metres (34): each square is 100 metres; the wreck 6 squares ahead is 600 metres ahead
//   5  Left and behind are minus (50): the whole grid, (-4, 6)
//   6  Across and ahead, all told (60): (-6, 4) at 100 metres a square: 600 across and 400 ahead, 1,000 metres
//   7  Straight there (82): (6, 8) squares of 100 metres, a straight line of 1,000 metres (the right triangle)
// (The crane's ladder has coordinates at 18 and plus and minus at 36; the pilot's map has its quarter at 30 and the whole
// map at 50: these sit with them. The straight line is the dock's brace across a panel, 86, a little younger here
// because the triangles are whole ones.)
//
//   JOB                       for the job panel (src/jobs/panel.js openPanel), dark like the jump computer's
//   sensorsHead(o)            the card's top (a live object's head: openPanel's `live`)
//   sensorsMap(opts)          the grid, drawn (svg): { hi, lo, at: [x, y], count, metres, line, legs, ask }
//   labPilot()                the labs' own pilot, whose level on the ladder is kept in this browser -> { crew, save }
import { ownOrder } from './engine.js';
import { NIGHT } from './pics.js';

export const SQUARE = 100;      // metres of the ground a square of the sensors' grid is
const K = NIGHT;
const kit = (rand) => ({ int: (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1)), pick: (a) => a[Math.floor(rand() * a.length)], chance: (p) => rand() < p,
  shuffle: (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; } });
const say = (n) => Number(n).toLocaleString('en-US');
const pair = (x, y) => `(${x < 0 ? '−' : ''}${Math.abs(x)}, ${y < 0 ? '−' : ''}${Math.abs(y)})`;
const P = (x, y) => ({ v: `(${x}, ${y})`, big: pair(x, y), small: '', label: pair(x, y) });
const SQ = ['square', 'squares'], MET = ['metre', 'metres'];
const C = (n, unit) => ({ v: n, big: say(n), small: n === 1 ? unit[0] : unit[1], label: `${say(n)} ${n === 1 ? unit[0] : unit[1]}` });
const across = (x) => (x < 0 ? 'to the left' : 'to the right'), ahead = (y) => (y < 0 ? 'behind' : 'ahead');

// ── the grid, drawn: the ship at (0, 0) pointing up the screen (ahead), the wreck where the sensors found it ─────────
const f = (v) => v.toFixed(1);
const txt = (x, y, s, { size = 9, fill = K.INK, weight = 700, anchor = 'middle' } = {}) => `<text x="${f(x)}" y="${f(y)}" font-size="${size}" font-weight="${weight}" fill="${fill}" stroke="${K.CARD}" stroke-width="2.4" paint-order="stroke" text-anchor="${anchor}" font-family="system-ui, sans-serif">${s}</text>`;
export function sensorsMap({ hi = 5, lo = 0, at = [3, 2], size = 210, count = false, metres = 0, line = false, legs = false, ask = '', hint = null }) {
  const pad = 20, span = hi - lo, u = (size - 2 * pad) / span, S = size, H = S + (ask ? 18 : 0) + (metres ? 14 : 0);
  const X = (x) => pad + (x - lo) * u, Y = (y) => S - pad - (y - lo) * u;
  let s = `<rect x="0" y="0" width="${S}" height="${H}" fill="${K.CARD}"/>`;
  // the grid's lines, the two through the ship brighter
  for (let k = lo; k <= hi; k++) {
    const axis = k === 0;
    s += `<path d="M${f(X(k))} ${f(Y(lo))}V${f(Y(hi))}M${f(X(lo))} ${f(Y(k))}H${f(X(hi))}" stroke="${axis ? K.SOFT : K.GRID}" stroke-width="${axis ? 1.4 : 0.8}"/>`;
  }
  // its numbers along the two lines through the ship (every one on a small grid, every other on a big one)
  const every = span > 10 ? 2 : 1;
  for (let k = lo; k <= hi; k++) {
    if (k === 0 || k % every) continue;
    s += txt(X(k), Y(0) + 11, k < 0 ? '−' + -k : k, { size: 8, fill: K.SOFT, weight: 600 }) + txt(X(0) - 7, Y(k) + 3, k < 0 ? '−' + -k : k, { size: 8, fill: K.SOFT, weight: 600, anchor: 'end' });
  }
  // which way is which: across, to the right; ahead, up the screen
  s += txt(X(hi) - 2, Y(0) - 5, 'across', { size: 8, fill: K.SOFT, weight: 700, anchor: 'end' }) + txt(X(0) + 5, Y(hi) + 10, 'ahead', { size: 8, fill: K.SOFT, weight: 700, anchor: 'start' });
  const [wx, wy] = at, sx = X(0), sy = Y(0), ex = X(wx), ey = Y(wy);
  // (the youngest: a dot in each square on the way, to count)
  if (count) {
    const n = Math.abs(wx) + Math.abs(wy), dx = Math.sign(wx), dy = Math.sign(wy);
    for (let i = 1; i <= n; i++) s += `<circle cx="${f(X(dx * (i - 0.5)))}" cy="${f(Y(dy * (i - 0.5)))}" r="${f(Math.max(2.2, u * 0.12))}" fill="${K.ASK}" opacity="0.85"/>`;
  }
  // a hint drawn over it (help): across first along the line through the ship, then ahead to the wreck
  if (hint === 'legs' || legs) {
    s += `<path d="M${f(sx)} ${f(sy)}H${f(ex)}" stroke="${K.ASK}" stroke-width="2.4" stroke-linecap="round"/><path d="M${f(ex)} ${f(sy)}V${f(ey)}" stroke="${K.ASK}" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="${hint === 'legs' ? 'none' : '5 3'}"/>`;
    if (legs) s += txt((sx + ex) / 2, sy + (wy < 0 ? -6 : 12), legs.across, { size: 9, fill: K.ASK }) + txt(ex + (wx < 0 ? -6 : 6), (sy + ey) / 2 + 3, legs.ahead, { size: 9, fill: K.ASK, anchor: wx < 0 ? 'end' : 'start' });
  }
  if (line) s += `<path d="M${f(sx)} ${f(sy)}L${f(ex)} ${f(ey)}" stroke="${K.BLUE}" stroke-width="2" stroke-dasharray="6 3"/>` + (line === true ? '' : txt((sx + ex) / 2 + (wx < 0 ? 8 : -8), (sy + ey) / 2 - 4, line, { size: 10, fill: K.BLUE, anchor: wx < 0 ? 'start' : 'end' }));
  // the ship, nose up the screen, and "us"
  s += `<path d="M${f(sx - 6)} ${f(sy + 6)}L${f(sx)} ${f(sy - 8)}L${f(sx + 6)} ${f(sy + 6)}L${f(sx)} ${f(sy + 3)}Z" fill="${K.SHIP}" stroke="${K.INK}" stroke-width="0.9"/>`;
  s += txt(sx + (wx > 0 || (wx === 0 && hi - wy < 2) ? -9 : 9), sy + 15, 'us', { size: 9, fill: K.SHIP, anchor: wx > 0 || (wx === 0 && hi - wy < 2) ? 'end' : 'start' });
  // the wreck: a broken ship, two pieces apart, in the sensors' warm mark
  const r = Math.max(5, Math.min(9, u * 0.38));
  s += `<g transform="translate(${f(ex)} ${f(ey)})"><circle r="${f(r + 3)}" fill="none" stroke="${K.FIELD}" stroke-width="1.4" opacity="0.7"/>`
    + `<path d="M${f(-r)} ${f(r * 0.1)}L${f(-r * 0.2)} ${f(-r * 0.55)}L${f(r * 0.05)} ${f(-r * 0.1)}L${f(-r * 0.45)} ${f(r * 0.5)}Z M${f(r * 0.25)} ${f(r * 0.05)}L${f(r)} ${f(-r * 0.35)}L${f(r * 0.7)} ${f(r * 0.6)}L${f(r * 0.2)} ${f(r * 0.5)}Z" fill="${K.FIELD}" stroke="${K.INK}" stroke-width="0.8"/></g>`;
  s += txt(ex + (wx >= hi - 1 ? -r - 5 : r + 5), ey - r - 2, 'wreck', { size: 9, fill: K.FIELD, anchor: wx >= hi - 1 ? 'end' : 'start' });
  let y0 = S;
  if (metres) { s += txt(S / 2, y0 + 8, `1 square = ${say(metres)} metres`, { size: 9.5, fill: K.SOFT, weight: 700 }); y0 += 14; }
  if (ask) s += txt(S / 2, y0 + 12, ask, { size: 10, fill: K.ASK, weight: 800 });
  return `<svg viewBox="0 0 ${S} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" class="bmp-svg">${s}</svg>`;
}

// ── the questions ─────────────────────────────────────────────────────────────────────────────────────────────────
// (a place for the wreck: x across, y ahead, each from lo to hi, never on a line through the ship, never as far across
// as ahead (so swapping them is never also right); `neg`: at least one of them minus)
function placeOf(t, lo, hi, { neg = false, least = 1 } = {}) {
  for (let k = 0; k < 80; k++) {
    const x = t.int(lo, hi), y = t.int(lo, hi);
    if (!x || !y || Math.abs(x) === Math.abs(y) || Math.max(Math.abs(x), Math.abs(y)) < least) continue;
    if (neg && x > 0 && y > 0) continue;
    return [x, y];
  }
  return neg ? [-3, 5] : [3, 2];
}
const STORY = 'Out of the jump, the sensors sweep the ground. They have found the wreck.';
const US = 'We are at (0, 0), our nose pointing up the grid.';

export const MAKERS = {
  // ── whole numbers on the grid ──────────────────────────────────────────────────────────────────────────────────
  // step 1  count the squares to it, straight ahead or straight across (up to 5)
  // step 2  where it is, across and then ahead (up to 5 each way)
  // step 3  the same up to 9
  grid: {
    strand: 'geo', at: (step) => [4, 18, 30][Math.max(1, Math.min(3, step)) - 1],
    make(step, { rand = Math.random } = {}) {
      const t = kit(rand);
      if (step <= 1) {
        const n = t.int(1, 5), side = t.chance(0.35), at = side ? [n, 0] : [0, n];
        return ownOrder({
          key: `grid:count:${side ? 'across' : 'ahead'}`, story: `${STORY} It is straight ${side ? 'across to our right' : 'ahead of us'}.`, ask: 'How many squares away is the wreck?',
          right: C(n, SQ),
          slips: [
            { ...C(n + 1, SQ), slip: 'off', why: 'One too many. Count the squares again, touching each one once.' },
            { ...C(n - 1, SQ), slip: 'off', why: 'One short. Count the squares again, touching each one once.' },
            { ...C(n + 2, SQ), slip: 'off', why: 'Too many. Count the squares from us to the wreck, touching each one once.' },
            { ...C(n + 3, SQ), slip: 'off', why: 'Too many. Count the squares from us to the wreck, touching each one once.' },
          ],
          rightWhy: `${say(n)} ${n === 1 ? 'square' : 'squares'} to the wreck`,
          picFirst: true, lead: sensorsMap({ hi: 5, lo: 0, at, count: true }),
          help: { title: 'Count the squares', svg: sensorsMap({ hi: 5, lo: 0, at, count: true }), line: 'Touch each dot once as you count: 1, 2, 3 ...' },
          own: { strand: 'geo', at: 4 }, credit: [{ strand: 'number', at: 4, weight: 0.5 }], facts: { x: at[0], y: at[1], unit: SQUARE, form: 'count', n },
        }, rand, 3);
      }
      const hi = step === 2 ? 5 : 9, [x, y] = placeOf(t, 1, hi, { least: step === 2 ? 2 : 5 });
      const wrongs = [[[y, x], 'swapped', 'the first number is how far across, the second how far ahead'], [[x + (x < hi ? 1 : -1), y], 'off', `count ${x} squares across from us`], [[x, y + (y < hi ? 1 : -1)], 'off', `count ${y} squares ahead`], [[x - (x > 1 ? 1 : -1), y], 'off', `count ${x} squares across from us`]];
      return ownOrder({
        key: `grid:pair:${hi}`, story: `${STORY} ${US}`, ask: 'Where is the wreck from us? (across, ahead)',
        right: P(x, y), slips: wrongs.map(([p, slip, why]) => ({ ...P(...p), slip, why: `Not ${pair(...p)}: ${why}.` })),
        rightWhy: `${x} across to the right, then ${y} ahead: ${pair(x, y)}`,
        lead: sensorsMap({ hi, lo: 0, at: [x, y], ask: 'the wreck: (?, ?)' }),
        help: { title: 'Across, then ahead', svg: sensorsMap({ hi, lo: 0, at: [x, y], hint: 'legs', legs: { across: `${x} across`, ahead: `${y} ahead` } }), line: 'Start at us, (0, 0). Count the squares across to the wreck\'s line: that is the first number. Then count the squares ahead: the second.', steps: ['First how far across', 'Then how far ahead'] },
        own: { strand: 'geo', at: step === 2 ? 18 : 30 }, facts: { x, y, unit: SQUARE, form: 'pair' },
      }, rand);
    },
  },
  // ── the whole grid: left of us and behind us are minus ─────────────────────────────────────────────────────────
  signs: {
    strand: 'geo', at: () => 50,
    make(step, { rand = Math.random } = {}) {
      const t = kit(rand), hi = 8, [x, y] = placeOf(t, -7, 7, { neg: true, least: 3 });
      const wrongs = [[[-x, y], 'sign', `the first number is ${x < 0 ? 'minus: the wreck is to our left' : 'not minus: the wreck is to our right'}`], [[x, -y], 'sign', `the second number is ${y < 0 ? 'minus: the wreck is behind us' : 'not minus: the wreck is ahead of us'}`],
        [[y, x], 'swapped', 'the first number is how far across (left is minus), the second how far ahead (behind is minus)'], [[-x, -y], 'sign', 'both signs are turned round there']];
      return ownOrder({
        key: 'signs:pair', story: `${STORY} ${US} Left of us is minus, and so is behind us.`, ask: 'Where is the wreck from us? (across, ahead)',
        right: P(x, y), slips: wrongs.map(([p, slip, why]) => ({ ...P(...p), slip, why: `Not ${pair(...p)}: ${why}.` })),
        rightWhy: `${Math.abs(x)} ${across(x)}, ${Math.abs(y)} ${ahead(y)}: ${pair(x, y)}`,
        lead: sensorsMap({ hi, lo: -hi, at: [x, y], ask: 'the wreck: (?, ?)' }),
        help: { title: 'Across, then ahead', svg: sensorsMap({ hi, lo: -hi, at: [x, y], hint: 'legs', legs: { across: `${Math.abs(x)} ${x < 0 ? 'left' : 'right'}`, ahead: `${Math.abs(y)} ${ahead(y)}` } }), line: 'Start at us, (0, 0). How far across is the first number: to the left it is minus. How far ahead is the second: behind us it is minus.', steps: [`Across: ${Math.abs(x)} ${across(x)}, so ${x}`, `Ahead: ${Math.abs(y)} ${ahead(y)}, so ${y}`] },
        own: { strand: 'geo', at: 50 }, credit: [{ strand: 'sub', at: 36, weight: 0.5 }], facts: { x, y, unit: SQUARE, form: 'signs' },
      }, rand);
    },
  },
  // ── distances: the squares as metres of the ground ──────────────────────────────────────────────────────────────
  // step 1  one way in metres: each square is 100 metres, 6 squares ahead is 600 metres
  // step 2  across and ahead, all told: (-6, 4) is 600 + 400 = 1,000 metres
  // step 3  straight there: (6, 8) squares, a straight line of 10 squares, 1,000 metres
  metres: {
    strand: 'geo', at: (step) => [34, 60, 82][Math.max(1, Math.min(3, step)) - 1],
    make(step, { rand = Math.random } = {}) {
      const t = kit(rand), U = SQUARE;
      if (step <= 1) {
        const [x, y] = placeOf(t, 1, 9, { least: 4 }), askAhead = t.chance(0.6), n = askAhead ? y : x, other = askAhead ? x : y;
        return ownOrder({
          key: `metres:one:${askAhead ? 'ahead' : 'across'}`, story: `${STORY} ${US} Each square of the grid is ${U} metres of the ground.`, ask: askAhead ? 'How many metres ahead of us is the wreck?' : 'How many metres across to our right is the wreck?',
          right: C(n * U, MET),
          slips: [
            { ...C(n, MET), slip: 'squares', why: `${n} is the squares. Each square is ${U} metres: ${n} squares of ${U}.` },
            { ...C(other * U, MET), slip: 'other', why: `${say(other * U)} metres is how far ${askAhead ? 'across' : 'ahead'} it is. The question asks how far ${askAhead ? 'ahead' : 'across'}.` },
            { ...C(n * 10, MET), slip: 'tens', why: `Each square is ${U} metres, not 10: ${n} squares of ${U}.` },
            { ...C((n + 1) * U, MET), slip: 'off', why: `Count the squares ${askAhead ? 'ahead' : 'across'} again: ${n}, each ${U} metres.` },
          ],
          rightWhy: `${n} squares of ${U} metres: ${say(n * U)} metres`, sum: { op: 'mul', a: n, b: U },
          lead: sensorsMap({ hi: 9, lo: 0, at: [x, y], metres: U, ask: askAhead ? 'ahead: ? metres' : 'across: ? metres' }),
          help: { title: 'Squares into metres', svg: sensorsMap({ hi: 9, lo: 0, at: [x, y], metres: U, hint: 'legs', legs: { across: `${x} squares`, ahead: `${y} squares` } }), line: `Count the squares ${askAhead ? 'ahead' : 'across'}, then make each one ${U} metres.`, steps: [`${askAhead ? 'Ahead' : 'Across'}: ${n} squares`, `${n} × ${U}`] },
          own: { strand: 'geo', at: 34 }, credit: [{ strand: 'mul', at: 30, weight: 0.5 }], facts: { x, y, unit: U, form: 'one' },
        }, rand);
      }
      if (step === 2) {
        const [x, y] = placeOf(t, -7, 7, { neg: true, least: 3 }), ax = Math.abs(x), ay = Math.abs(y), n = (ax + ay) * U, signed = Math.abs(x + y) * U;
        return ownOrder({
          key: 'metres:both', story: `${STORY} ${US} Each square is ${U} metres. The ship flies across to the wreck's line first, then straight on to it.`, ask: 'How many metres is that, all told?',
          right: C(n, MET),
          slips: [
            ...(signed && signed !== n ? [{ ...C(signed, MET), slip: 'sign', why: `${pair(x, y)} is ${ax} squares across and ${ay} ${ahead(y)}. A minus is only which way: the metres flown are ${ax} and ${ay} squares.` }] : []),
            { ...C(ax + ay, MET), slip: 'squares', why: `${ax + ay} is the squares. Each square is ${U} metres.` },
            { ...C(Math.max(ax, ay) * U, MET), slip: 'oneLeg', why: `That is only one way. Across ${ax} squares and ${ahead(y)} ${ay}: both.` },
            { ...C(n + U, MET), slip: 'off', why: `Across ${ax} squares and ${ahead(y)} ${ay}: add them, then ${U} metres each.` },
          ],
          rightWhy: `${ax} across and ${ay} ${ahead(y)} make ${ax + ay} squares: ${say(n)} metres`, sum: [{ op: 'add', a: ax, b: ay, say: 'The squares, across and then the rest' }, { op: 'mul', a: ax + ay, b: U, say: 'Then the metres' }],
          lead: sensorsMap({ hi: 8, lo: -8, at: [x, y], metres: U, ask: 'across, then on: ? metres' }),
          help: { title: 'Across, then on to it', svg: sensorsMap({ hi: 8, lo: -8, at: [x, y], metres: U, hint: 'legs', legs: { across: `${ax} across`, ahead: `${ay} ${ahead(y)}` } }), line: 'The minus only says which way. Count the squares across and the squares on to it, add them, and make each square 100 metres.', steps: [`${ax} + ${ay}`, `${ax + ay} × ${U}`] },
          own: { strand: 'geo', at: 60 }, credit: [{ strand: 'add', at: 22, weight: 0.5 }, { strand: 'mul', at: 30, weight: 0.5 }], facts: { x, y, unit: U, form: 'both' },
        }, rand);
      }
      // straight there: a right triangle of whole squares
      const [a, b, c] = t.pick([[3, 4, 5], [4, 3, 5], [6, 8, 10], [8, 6, 10]]), x = a * (t.chance(0.5) ? -1 : 1), y = b * (t.chance(0.7) ? 1 : -1), n = c * U;
      return ownOrder({
        key: 'metres:straight', story: `${STORY} ${US} Each square is ${U} metres. The ship flies straight to it.`, ask: 'How many metres is it in a straight line?',
        right: C(n, MET),
        slips: [
          { ...C((a + b) * U, MET), slip: 'legs', why: `${say((a + b) * U)} metres is across and then ahead, along the grid. Straight across the corner is shorter.` },
          { ...C(Math.max(a, b) * U, MET), slip: 'oneLeg', why: `That is only the longer way along the grid. The straight line is longer than either.` },
          { ...C(c, MET), slip: 'squares', why: `${c} is the squares. Each square is ${U} metres.` },
          { ...C((c + 1) * U, MET), slip: 'off', why: `${a} × ${a} + ${b} × ${b} = ${c * c}, and ${c} × ${c} = ${c * c}: ${c} squares.` },
        ],
        rightWhy: `${a}² + ${b}² = ${a * a} + ${b * b} = ${c * c} = ${c}²: ${c} squares, ${say(n)} metres`,
        sum: [{ op: 'mul', a, b: a, say: 'Across, squared' }, { op: 'mul', a: b, b, say: 'Ahead, squared' }, { op: 'add', a: a * a, b: b * b, say: 'Add them' }],
        lead: sensorsMap({ hi: 8, lo: -8, at: [x, y], metres: U, line: '?', ask: 'straight there: ? metres' }),
        help: { title: 'The right triangle', svg: sensorsMap({ hi: 8, lo: -8, at: [x, y], metres: U, line: 'c', legs: { across: `a = ${a}`, ahead: `b = ${b}` } }), line: `Across and ahead are the two short sides of a right triangle; the straight line is the long side: a² + b² = c². Then ${U} metres a square.`, steps: [`${a} × ${a} + ${b} × ${b}`, `The number that times itself makes ${c * c}`, `Then × ${U}`] },
        own: { strand: 'geo', at: 82 }, credit: [{ strand: 'mul', at: 30, weight: 0.5 }], facts: { x, y, unit: U, form: 'straight' }, size: 2,
      }, rand);
    },
  },
};

const M = (maker, step, w = 1) => ({ maker, step, w });
export const PLACE = {
  id: 'sensors', name: 'The sensors', short: 'Sensors', math: 'Coordinates: the wreck on a grid, then how far it is', pic: 'pilot', job: null,
  line: 'Out of the jump over a planet: where the sensors found the wreck, on a grid with the ship at its middle; then how far it is in metres.',
  levels: [
    { id: 'count', title: 'Squares to the wreck', line: 'Straight ahead, up to 5 squares: count them', gen: { mix: [M('grid', 1)] } },
    { id: 'pair5', title: 'Across, then ahead', line: 'The wreck at (3, 2): 3 across, 2 ahead', gen: { mix: [M('grid', 2)] } },
    { id: 'pair9', title: 'Up to nine', line: 'The wreck at (7, 5)', gen: { mix: [M('grid', 3, 2), M('grid', 2)] } },
    { id: 'metres', title: 'Squares into metres', line: 'Each square is 100 metres: 6 squares ahead is 600 metres', gen: { mix: [M('metres', 1, 2), M('grid', 3)] } },
    { id: 'signs', title: 'Left and behind are minus', line: 'The whole grid: the wreck at (−4, 6)', gen: { mix: [M('signs', 1, 2), M('metres', 1)] } },
    { id: 'both', title: 'Across and ahead, all told', line: '(−6, 4) at 100 metres a square: 1,000 metres', gen: { mix: [M('metres', 2, 2), M('signs', 1)] } },
    { id: 'straight', title: 'Straight there', line: '(6, 8) squares of 100 metres: a straight line of 1,000 metres', gen: { mix: [M('metres', 3, 2), M('metres', 2)] } },
  ],
};

export const JOB = {
  // (not a station job spot: its card comes up as the ship comes out over a planet on a rescue (in the labs for now:
  // the Planet Lab). Not on the crew screen's list of levels yet: that comes with the run in the game)
  id: 'sensors', name: 'Sensors', short: 'Sensors', open: true, seated: true,
  spot: null, sign: 'Sensors', hint: 'Find the wreck',
  place: PLACE, setting: null, makers: MAKERS,
  card: 'sensors',
  dark: true,      // drawn dark with light lines, as the jump computer's
};

// THE CARD'S TOP, as the jump computer's: its own mark, "Sensors", and what it is for
export const sensorsHead = (where = 'Finding the wreck') => `<header class="pnj-cardtop is-jump"><span class="pnj-icon is-radar" aria-hidden="true"></span><b>Sensors</b><small>${where}</small></header>`;

// THE LABS' PILOT: a crew member of the labs' own, whose level on the sensors' ladder is kept in this browser (the
// arrows in the card's top strip step it; Mathwood's levels find it by itself at first)
const LAB_KEY = 'pi-nebula.sensors.pilot';
export function labPilot() {
  let crew = null;
  try { crew = JSON.parse(localStorage.getItem(LAB_KEY)); } catch (e) { /* none kept */ }
  if (!crew || typeof crew !== 'object' || crew.id !== 'sensors-lab') crew = { id: 'sensors-lab', name: 'Pilot' };
  return { crew, save: () => { try { localStorage.setItem(LAB_KEY, JSON.stringify(crew)); } catch (e) { /* blocked: not kept */ } } };
}
