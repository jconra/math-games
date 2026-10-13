// Supply orders for the camps (the delivery job, src/missions/delivery.js): a camp's foreman asks for "enough beans to
// last a fortnight for 6 hands, 3 meals a day; beans come in crates of 12", and at the general store the kid works the
// order out a step at a time on the store's order slip (src/ui/storeslip.js), picking a coin for each step:
//   vocab   what a word means in days or cans: a week = 7 days, a fortnight = 14 days (fourteen nights), a dozen = 12.
//           Asked while the word is new to the kid (until VOCAB_KNOWN right first time); after that it's left out
//   total   how much in all: 6 hands x 3 meals x 14 days = 252 cans (three numbers multiplied; two on the first step)
//   crates  how many crates: 252 / 12 = 21; and when it doesn't come out even, ROUNDED UP: 250 cans would still need 21
//           crates (20 crates hold only 240, the last 10 cans need a crate too)
//   cost    (from step 5) what the order costs at the store: 21 crates at $3 = $63
// Each wrong coin is a slip kids really make, with one plain line about it: used 7 days for a fortnight; multiplied only
// two of the three numbers (a day's worth, one hand's worth, one meal a day); added the numbers; forgot to round up
// (dropped the leftover cans); took a crate too many; multiplied the cans by the crate size; priced every can.
// A wrong pick also shows the picture for that step (picture(pic) below): two weeks of days on a calendar, a day's
// meals and the days in a row, the cans packed into crates with the leftover ones that need a crate of their own, the
// crates and their prices. The picture never shows the answer, only '?'.
//
// The ladder (LADDER): 3 orders right first time (every step of the order) in a row move up a step; a wrong first pick
// on any step of an order moves down a step (once an order). On a kid's first visit the step climbs after every clean
// order; the second miss ends the climb and the kid settles PLACE_BELOW below. A right pick after the kid asked for the
// picture is paid the same but doesn't count toward the climb (peeking never costs anything).
//
//   const S = makeSupplies(rider.topics.delivery ||= {}, { rand })
//   S.next({ camp, who })   -> an order (see makeSupplyOrder); camp: { id, short }, who: the foreman's name
//   S.answer(order, partIndex, coin, { helped }) -> { right, first, moved, step, placed, clean }   (clean: on the order's
//                           last step, true when every step was right first time; null before)
//   S.level()  S.state
//   picture(pic) -> { svg, title, line }   the picture for a step (the store's own pictures for the cost)
// Pure: no page, no three.js. tests/supplies.test.mjs checks it.
import { picture as storePicture } from '../ui/storepics.js';

export const CLEAN_TO_CLIMB = 3;     // orders right first time in a row to move up a step
export const PLACEMENT_MISSES = 2;   // the first-visit climb ends at this many misses (one slip is forgiven)
export const PLACE_BELOW = 1;        // ...and the kid settles this many steps below the step of that miss
export const VOCAB_KNOWN = 2;        // a word answered right first time this many times is known: its question is left out

// The ladder. two: the first step multiplies two numbers (hands x days, a can a day each); period: how the time is
// told ('days' as a number, 'week' / 'fortnight' as words); exact: the crates come out even (else they must be rounded
// up); cost: the order's price is asked too; goods: what is ordered; size: how big the numbers get.
export const LADDER = [
  { label: 'Hands times days (a can each a day)', two: true, period: ['days'], exact: true, cost: false, goods: ['beans'], size: 1 },
  { label: 'Three numbers: hands, meals and days', two: false, period: ['days'], exact: true, cost: false, goods: ['beans', 'coffee'], size: 1 },
  { label: 'A week and a fortnight', two: false, period: ['week', 'fortnight', 'fortnight'], exact: true, cost: false, goods: ['beans', 'coffee'], size: 2 },
  { label: 'Rounding up to whole crates', two: false, period: ['days', 'week', 'fortnight'], exact: false, cost: false, goods: ['beans', 'coffee', 'oats'], size: 2 },
  { label: 'What the order costs', two: false, period: ['days', 'week', 'fortnight'], exact: false, cost: true, goods: ['beans', 'coffee', 'oats'], size: 2 },
  { label: 'Big orders: dozens, sacks and tins', two: false, period: ['week', 'fortnight', 'days'], exact: false, cost: true, goods: ['beans', 'coffee', 'oats', 'flour'], size: 3 },
];

// what each kind of supply is: who eats it (hands or horses), how much each a day, what it comes in
//   rate: [one, many] for the amount a meal or a day; per: the choices for how many a crate holds; price: $ a crate
export const GOODS = {
  beans: { name: 'beans', who: ['hand', 'hands'], unit: ['can', 'cans'], box: ['crate', 'crates'], each: (m) => `a can of beans at every meal, ${m} meals a day`, two: 'a can of beans a day each', per: [4, 5, 6, 10, 12, 20, 24], price: [2, 3, 4] },
  coffee: { name: 'coffee', who: ['hand', 'hands'], unit: ['cup', 'cups'], box: ['tin', 'tins'], each: (m) => `${m} cups of coffee a day`, two: 'a cup of coffee a day each', per: [10, 12, 20, 25, 30], price: [2, 3, 5] },
  oats: { name: 'oats', who: ['horse', 'horses'], unit: ['pound', 'pounds'], box: ['sack', 'sacks'], each: (m) => `${m} pounds of oats a day`, two: 'a pound of oats a day each', per: [10, 20, 25, 50], price: [2, 4, 5] },
  flour: { name: 'flour', who: ['hand', 'hands'], unit: ['pound', 'pounds'], box: ['sack', 'sacks'], each: (m) => `${m} pounds of flour a day`, two: 'a pound of flour a day each', per: [10, 20, 25], price: [3, 4] },
};
// the words for lengths of time (and the dozen), what they come to, and the slips kids make with them
export const WORDS = {
  week: { days: 7, ask: 'How many days are in a week?', slips: [
    { v: 5, why: 'Five is the working days. A week is every day of it: 7 days.' },
    { v: 14, why: '14 days is a fortnight, two weeks. One week is 7 days.' },
    { v: 6, why: 'Count them: Sunday to Saturday is 7 days.' },
  ], line: 'A week is 7 days.' },
  fortnight: { days: 14, ask: 'First things first: how many days are in a fortnight?', slips: [
    { v: 7, why: '7 days is one week. A fortnight is two weeks: 7 + 7 = 14 days.' },
    { v: 2, why: '2 is how many weeks. The order needs days: 2 weeks × 7 days = 14 days.' },
    { v: 15, why: 'Close! "Fortnight" is short for "fourteen nights": 14 days.' },
  ], line: 'A fortnight is two weeks: 14 days ("fourteen nights").' },
  dozen: { n: 12, ask: 'How many is a dozen?', slips: [
    { v: 10, why: 'A dozen is 12, like a dozen eggs. Ten is ten.' },
    { v: 6, why: '6 is half a dozen. A whole dozen is 12.' },
    { v: 13, why: '13 is a "baker\'s dozen" (one extra). A plain dozen is 12.' },
  ], line: 'A dozen is 12.' },
};

export function seeded(seed = 1) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function tools(rand) {
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  return { rand, int, pick, shuffle };
}
const u = (n, unit) => `${n} ${n === 1 ? unit[0] : unit[1]}`;
const S3 = (size, a, b, c) => [a, b, c][Math.max(1, Math.min(3, size)) - 1];
const money = (n) => `$${n}`;

// a coin's face: the big number and the small units under it
function face(v, unit) {
  if (unit === 'money') return { v, big: money(v), small: v === 1 ? 'dollar' : 'dollars', label: money(v) };
  return { v, big: String(v), small: v === 1 ? unit[0] : unit[1], label: u(v, unit) };
}
// the right coin and up to n-1 wrong ones from the slips (in order, skipping repeats, the answer, and anything not a
// whole number above 0), shuffled
function coins(t, answer, unit, slips, n) {
  const used = new Set([answer]), wrong = [];
  for (const s of slips) {
    if (wrong.length >= n - 1) break;
    if (!Number.isInteger(s.v) || s.v <= 0 || used.has(s.v)) continue;
    used.add(s.v); wrong.push({ ...face(s.v, unit), good: false, slip: s.slip || null, why: s.why });
  }
  return t.shuffle([{ ...face(answer, unit), good: true, slip: null, why: '' }, ...wrong]);
}

// ── AN ORDER ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// -> { id, step, camp, who, goods, story, card: { main, sub }, period: { word, days }, hands, rate, days, per, price,
//      total, crates, cost, leftover, parts: [{ key, ask, coins, pic, rightWhy }], load: { n, box, goods } }
// vocab: the words still new to this kid ({ fortnight: true }): their question comes first
export function makeSupplyOrder({ rand = Math.random, step = 1, camp = { id: 'cow', short: 'the cow camp' }, who = 'The foreman', vocab = {} } = {}) {
  const t = tools(rand);
  const L = LADDER[Math.max(1, Math.min(LADDER.length, step)) - 1];
  for (let tries = 0; tries < 200; tries++) {
    const gk = t.pick(L.goods), G = GOODS[gk];
    const word = t.pick(L.period);
    const days = word === 'week' ? 7 : word === 'fortnight' ? 14 : t.int(L.two ? 3 : 2, S3(L.size, L.two ? 9 : 6, 10, 12));
    const hands = t.int(2, S3(L.size, 6, 8, 12)) + (gk === 'oats' ? 0 : 0);
    const rate = L.two ? 1 : t.int(2, S3(L.size, 3, 3, 4));
    const total = hands * rate * days;
    // the crate: a dozen sometimes (named as a word on the top step, so it's a vocab question there too)
    const per = t.pick(G.per);
    if (per >= total) continue;
    const exact = total % per === 0;
    if (L.exact !== exact) continue;
    const crates = Math.ceil(total / per), leftover = total - Math.floor(total / per) * per;
    if (crates > 30 || crates < 2) continue;
    const price = L.cost ? t.pick(G.price) : 0, cost = crates * price;
    const dozen = per === 12 && step >= LADDER.length && gk === 'beans';
    const time = word === 'days' ? `${days} days` : `a ${word}`;
    const whoLine = gk === 'oats' ? `${hands} horses` : `${hands} hands`;
    const eat = L.two ? G.two : G.each(rate);
    const story = `${who} at ${camp.short} needs ${G.name} to last ${time}: ${whoLine}, ${eat}. `
      + `${G.name[0].toUpperCase() + G.name.slice(1)} come${G.name === 'oats' || G.name === 'beans' ? '' : 's'} in ${G.box[1]} of ${dozen ? 'a dozen' : per} ${G.unit[1]}.`;
    const parts = [];
    // VOCAB: the time word (and the dozen) while it's new
    for (const w of [word === 'days' ? null : word, dozen ? 'dozen' : null]) {
      if (!w || !vocab[w]) continue;
      const W = WORDS[w], ans = W.days || W.n;
      parts.push({ key: 'vocab', word: w, ask: W.ask, coins: coins(t, ans, w === 'dozen' ? G.unit : ['day', 'days'], W.slips.map((s) => ({ ...s, slip: 'word' })), L.two ? 3 : 4),
        pic: { kind: w === 'dozen' ? 'dozen' : 'calendar', days: ans, word: w }, rightWhy: W.line });
    }
    // TOTAL: hands x rate x days (two numbers on the first step)
    {
      const H = hands, R = rate, D = days, who1 = gk === 'oats' ? 'horse' : 'hand', whoN = gk === 'oats' ? 'horses' : 'hands', unit = G.unit;
      const what = gk === 'oats' ? 'pounds' : unit[1];
      const ask = `How many ${what} of ${G.name} is that for ${time === `${days} days` ? `all ${days} days` : `the ${word}`}?`;
      const slips = [];
      if (word === 'fortnight') slips.push({ v: H * R * 7, slip: 'week7', why: `That's 7 days' worth. A fortnight is 14 days, two weeks: ${H} × ${R} × 14.` });
      if (L.two) {
        slips.push({ v: H + D, slip: 'added', why: `${H} + ${D} adds ${whoN} to days. Each of the ${H} ${whoN} needs one a day, for ${D} days: ${H} × ${D}.` });
        slips.push({ v: H, slip: 'oneDay', why: `${H} is just one day's worth. They need it for ${D} days.` });
        slips.push({ v: D, slip: 'oneHand', why: `${D} is enough for one ${who1}. There are ${H} of them.` });
        slips.push({ v: H * (D + 1), slip: 'dayOff', why: `That's ${D + 1} days' worth. They need ${D}.` });
      } else {
        slips.push({ v: H * R, slip: 'twoOnly', why: `${H} × ${R} is one day's worth. Now times the ${D} days: ${H} × ${R} × ${D}.` });
        slips.push({ v: R * D, slip: 'twoOnly', why: `${R} × ${D} is enough for one ${who1}. There are ${H} ${whoN}: times ${H}.` });
        slips.push({ v: H * D, slip: 'twoOnly', why: `${H} × ${D} leaves out the ${R} a day. Each ${who1} needs ${R} every day: times ${R}.` });
        slips.push({ v: H + R + D, slip: 'added', why: `${H} + ${R} + ${D} adds them. It's ${H} ${whoN}, ${R} each a day, for ${D} days: multiply all three.` });
        slips.push({ v: H * R * (D - 1), slip: 'dayOff', why: `That's ${D - 1} days' worth. They need ${D}.` });
      }
      parts.push({ key: 'total', ask, coins: coins(t, total, unit, slips, L.two ? 3 : 4),
        pic: { kind: 'meals', hands: H, rate: R, days: D, who: [who1, whoN], unit, word, two: !!L.two },
        rightWhy: L.two ? `${H} ${whoN} × ${D} days = ${u(total, unit)}` : `${H} ${whoN} × ${R} a day × ${D} days = ${u(total, unit)}` });
    }
    // CRATES: total / per, rounded up
    {
      const full = Math.floor(total / per);
      const slips = exact
        ? [{ v: crates + 1, slip: 'extra', why: `${u(crates, G.box)} already hold all ${total}. One more is extra.` },
          { v: crates - 1, slip: 'short', why: `${u(crates - 1, G.box)} hold only ${(crates - 1) * per}. They need ${total}.` },
          total * per <= 9999 ? { v: total * per, slip: 'multiplied', why: `${total} × ${per} multiplies. Split the ${total} into ${G.box[1]} of ${per} instead: ${total} ÷ ${per}.` }
            : { v: total + per, slip: 'added', why: `${total} + ${per} adds them. Split the ${total} into ${G.box[1]} of ${per}: ${total} ÷ ${per}.` },
          { v: total - per, slip: 'subtracted', why: `${total} − ${per} takes one ${G.box[0]} away. Count how many ${G.box[1]} of ${per} make ${total}.` }]
        : [{ v: full, slip: 'roundDown', why: `${u(full, G.box)} hold ${full * per}. That leaves ${leftover} ${G.unit[1]} with nowhere to go: they need one more ${G.box[0]}.` },
          { v: full + 2, slip: 'extra', why: `${u(full + 1, G.box)} already hold all ${total} (room for ${(full + 1) * per}). One more is extra.` },
          total * per <= 9999 ? { v: total * per, slip: 'multiplied', why: `${total} × ${per} multiplies. Split the ${total} into ${G.box[1]} of ${per} instead: ${total} ÷ ${per}.` }
            : { v: total + per, slip: 'added', why: `${total} + ${per} adds them. Split the ${total} into ${G.box[1]} of ${per}: ${total} ÷ ${per}.` },
          { v: total - per, slip: 'subtracted', why: `${total} − ${per} takes one ${G.box[0]} away. Count how many ${G.box[1]} of ${per} make ${total}.` }];
      parts.push({ key: 'crates', ask: `${G.name[0].toUpperCase() + G.name.slice(1)} come${G.name === 'oats' || G.name === 'beans' ? '' : 's'} ${per} to a ${G.box[0]}. How many ${G.box[1]} make enough for ${total} ${G.unit[1]}?`,
        coins: coins(t, crates, G.box, slips, L.two ? 3 : 4),
        pic: { kind: 'pack', total, per, box: G.box, unit: G.unit },
        rightWhy: exact ? `${total} ÷ ${per} = ${u(crates, G.box)}` : `${full} full ${G.box[1]} hold ${full * per}, and 1 more for the last ${leftover}: ${u(crates, G.box)}` });
    }
    // COST: crates x price
    if (L.cost) {
      const slips = [
        { v: total * price, slip: 'perCan', why: `That prices every one of the ${total} ${G.unit[1]}. The store sells by the ${G.box[0]}: ${crates} ${G.box[1]} × $${price}.` },
        { v: crates + price, slip: 'added', why: `${crates} + ${price} adds them. Each of the ${crates} ${G.box[1]} costs $${price}: ${crates} × $${price}.` },
        exact ? { v: (crates + 1) * price, slip: 'groupOff', why: `That pays for ${crates + 1} ${G.box[1]}. The order is ${crates}.` }
          : { v: Math.floor(total / per) * price, slip: 'roundDown', why: `That pays for ${Math.floor(total / per)} ${G.box[1]}. The order is ${crates}, the last one too.` },
        { v: price, slip: 'one', why: `$${price} pays for one ${G.box[0]}. The order is ${crates}.` },
      ];
      parts.push({ key: 'cost', ask: `A ${G.box[0]} of ${G.name} is $${price} at the store. What does the order of ${u(crates, G.box)} cost?`,
        coins: coins(t, cost, 'money', slips, 4),
        pic: { kind: 'groups', groups: crates, each: price, item: G.box, unit: 'money', cents: false },
        rightWhy: `${crates} ${G.box[1]} × $${price} = $${cost}` });
    }
    if (parts.some((p) => p.coins.length < 3)) continue;
    return {
      id: Math.floor(rand() * 1e9).toString(36), step, camp: camp.id, who, goods: gk, story,
      card: { main: `${camp.short[0].toUpperCase() + camp.short.slice(1)}: ${G.name} for ${time}`, sub: `${whoLine}, ${L.two ? 'one a day each' : `${rate} a day each`} · ${G.box[1]} of ${dozen ? 'a dozen' : per}` },
      period: { word, days }, hands, rate, days, per, price, total, crates, cost, leftover: exact ? 0 : leftover, exact,
      parts, load: { n: crates, box: G.box, goods: G.name },
    };
  }
  throw new Error('no supply order could be made for step ' + step);
}

// ── THE TRAINER ──────────────────────────────────────────────────────────────────────────────────────────────────────
function fill(s) {
  const d = { v: 1, step: 1, placing: true, misses: 0, streak: 0, n: 0, clean: 0, vocab: {}, byPart: {}, delivered: 0 };
  for (const [k, v] of Object.entries(d)) if (s[k] === undefined || s[k] === null || typeof s[k] !== typeof v) s[k] = v && typeof v === 'object' ? {} : v;
  s.step = Math.max(1, Math.min(LADDER.length, Math.round(Number(s.step) || 1)));
  return s;
}

export function makeSupplies(state = {}, { rand = Math.random } = {}) {
  const s = fill(state);
  const orders = new Map();   // order id -> { first: Set of parts picked, miss, helped }
  function next({ camp, who } = {}) {
    const vocab = {};
    for (const w of Object.keys(WORDS)) if ((s.vocab[w] || 0) < VOCAB_KNOWN) vocab[w] = true;
    const o = makeSupplyOrder({ rand, step: s.step, camp, who, vocab });
    orders.set(o.id, { first: new Set(), miss: false, helped: false });
    if (orders.size > 20) orders.delete(orders.keys().next().value);
    s.n++;
    return o;
  }
  // a pick on step i of an order. Only the first pick of each step counts; the ladder moves when the order's last step
  // is answered (once an order): down a step if any first pick was wrong, toward the climb if none was
  function answer(order, i, coin, { helped = false } = {}) {
    const part = order.parts[i], c = typeof coin === 'number' ? part.coins[coin] : coin;
    const right = !!(c && c.good);
    let rec = orders.get(order.id);
    if (!rec) { rec = { first: new Set(), miss: false, helped: false }; orders.set(order.id, rec); }
    const first = !rec.first.has(i);
    const out = { right, first, moved: 0, step: s.step, placed: false, clean: null };
    if (!first) return out;
    rec.first.add(i);
    const bp = (s.byPart[part.key] = s.byPart[part.key] || { n: 0, right: 0 }); bp.n++; if (right) bp.right++;
    if (part.key === 'vocab' && right && !helped) s.vocab[part.word] = (s.vocab[part.word] || 0) + 1;
    if (!right) rec.miss = true;
    if (helped) rec.helped = true;
    // the ladder: on the last step's first pick (a wrong pick there still ends the order's say)
    const last = rec.first.size >= order.parts.length;
    if (!last && right) return out;
    if (rec.counted) return out;
    if (!last && !right) {
      // a miss on an early step counts at once (so the climb can't be won with the rest), once an order
      rec.counted = true; ladderMiss(order, out); return out;
    }
    rec.counted = true;
    out.clean = !rec.miss;
    if (rec.miss) ladderMiss(order, out);
    else if (!rec.helped) {
      s.clean++;
      if (order.step === s.step) {
        if (s.placing) { if (s.step < LADDER.length) { s.step++; out.moved = 1; } else { s.placing = false; out.placed = true; } }
        else if (++s.streak >= CLEAN_TO_CLIMB) { s.streak = 0; if (s.step < LADDER.length) { s.step++; out.moved = 1; } }
      }
    }
    out.step = s.step;
    return out;
  }
  function ladderMiss(order, out) {
    s.streak = 0;
    if (order.step !== s.step) return;
    if (s.placing) {
      if (++s.misses >= PLACEMENT_MISSES) { s.placing = false; out.placed = true; const to = Math.max(1, s.step - PLACE_BELOW); out.moved = to - s.step; s.step = to; }
    } else { const to = Math.max(1, s.step - 1); out.moved = to - s.step; s.step = to; }
    out.step = s.step;
  }
  function level() {
    const L = LADDER[s.step - 1];
    return { step: s.step, of: LADDER.length, label: L.label, placing: s.placing, line: `Step ${s.step} of ${LADDER.length}: ${L.label}${s.placing ? ' (still finding the right step)' : ''}` };
  }
  return { next, answer, level, state: s };
}

// ── THE PICTURES ─────────────────────────────────────────────────────────────────────────────────────────────────────
// the same parchment inks as the store's pictures (src/ui/storepics.js)
const INK = '#2b2219', SOFT = '#8a7558', FILL = '#ead9b2', FILL2 = '#d9bf8a', BRASS = '#b47f2c', ASK = '#b5523a';
const PW = 360;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const text = (x, y, s, { size = 13, fill = INK, anchor = 'middle', weight = 600 } = {}) =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="Bitter, Georgia, serif">${esc(s)}</text>`;
const svg = (h, body) => `<svg viewBox="0 0 ${PW} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" class="bmp-svg">${body}</svg>`;
const rect = (x, y, w, h, { fill = FILL, stroke = INK, dash = false, rx = 3 } = {}) =>
  `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(1, w).toFixed(1)}" height="${h.toFixed(1)}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="1.3"${dash ? ' stroke-dasharray="4 3"' : ''}/>`;

const DRAW = {
  // two weeks of days (or one) on a calendar: the squares to count, the total a '?'
  calendar(p) {
    const weeks = p.days / 7, cw = (PW - 20) / 7, ch = 26;
    let s = '';
    const names = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    for (let i = 0; i < 7; i++) s += text(10 + cw * (i + 0.5), 14, names[i], { size: 11, fill: SOFT });
    for (let w = 0; w < weeks; w++) {
      for (let i = 0; i < 7; i++) s += rect(10 + cw * i + 1, 22 + w * (ch + 6), cw - 2, ch, { fill: w % 2 ? FILL2 : FILL });
      s += text(PW - 12, 22 + w * (ch + 6) + ch + 13, `week ${w + 1}`, { size: 11, anchor: 'end', fill: BRASS, weight: 700 });
    }
    const h = 22 + weeks * (ch + 6) + 18;
    s += text(10, h - 2, p.word === 'fortnight' ? 'a fortnight = two weeks: how many days?' : 'one week: how many days?', { size: 13, anchor: 'start', fill: ASK, weight: 800 });
    return { svg: svg(h + 6, s), line: p.word === 'fortnight' ? 'A fortnight is two weeks ("fourteen nights"). Count the squares: two rows of 7.' : 'A week runs Sunday to Saturday: count the squares.' };
  },
  // a dozen: eggs in a box, two rows of six
  dozen() {
    let s = rect(40, 14, PW - 80, 70, { fill: FILL2 });
    for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) s += `<ellipse cx="${(70 + i * 44).toFixed(1)}" cy="${(36 + r * 28).toFixed(1)}" rx="12" ry="10" fill="#f6efe0" stroke="${INK}" stroke-width="1.1"/>`;
    s += text(PW / 2, 104, 'a dozen eggs: two rows of 6. How many?', { size: 13, fill: ASK, weight: 800 });
    return { svg: svg(112, s), line: 'A dozen is what an egg box holds: two rows of six.' };
  },
  // one day: each hand's meals as dots; then the days in a row, each a day's worth; the total a '?'
  meals(p) {
    const H = p.hands, R = p.rate, D = p.days;
    let s = text(10, 14, p.two ? 'Each day' : 'One day', { size: 12, anchor: 'start', fill: BRASS, weight: 800 });
    // the hands: a column of R dots each (one dot each on the first step)
    const show = Math.min(H, 12), gap = Math.min(28, (PW - 20) / show);
    for (let i = 0; i < show; i++) {
      const cx = 10 + gap * (i + 0.5);
      s += `<circle cx="${cx.toFixed(1)}" cy="28" r="7" fill="${FILL2}" stroke="${INK}" stroke-width="1.1"/>`;   // (a head)
      for (let k = 0; k < R; k++) s += `<circle cx="${cx.toFixed(1)}" cy="${(44 + k * 9).toFixed(1)}" r="3.4" fill="${BRASS}"/>`;
    }
    const dayLine = p.two ? `${H} ${p.who[1]}, 1 each = ${H} a day` : `${H} ${p.who[1]} × ${R} each = one day's worth`;
    s += text(10 + gap * show + 8, 40, dayLine, { size: 12, anchor: 'start', fill: SOFT });
    // the days: a row of boxes, each holding a day's worth
    const y = 50 + R * 9 + 18, n = Math.min(D, 14), bw = (PW - 20) / n;
    s += text(10, y - 6, `${D} days${p.word && p.word !== 'days' ? ` (a ${p.word})` : ''}`, { size: 12, anchor: 'start', fill: BRASS, weight: 800 });
    for (let i = 0; i < n; i++) s += rect(10 + i * bw + 1, y, bw - 2, 22, { fill: FILL });
    s += text(PW / 2, y + 40, `in all: ? ${p.unit[1]}`, { size: 14, fill: ASK, weight: 800 });
    return { svg: svg(y + 48, s), line: p.two ? `Every day each of the ${H} ${p.who[1]} needs one, for ${D} days.` : `Work out one day first (${p.who[1]} × each a day), then that many again for every one of the ${D} days.` };
  },
  // the cans packed into crates: full crates of `per`, and the leftover that needs a crate too
  pack(p) {
    const per = p.per, total = p.total, full = Math.floor(total / per), left = total - full * per;
    const x0 = 10, x1 = PW - 10, scale = (x1 - x0) / (full * per + (left ? per : 0));
    let s = rect(x0, 18, total * scale, 26, { fill: FILL2 }) + text(x0 + total * scale / 2, 36, `${total} ${p.unit[1]}`, { size: 13 });
    const shown = Math.min(3, full);
    for (let i = 0; i < shown; i++) s += rect(x0 + i * per * scale + 1, 58, per * scale - 2, 30) + text(x0 + (i + 0.5) * per * scale, 78, String(per), { size: 12 });
    const mid0 = x0 + shown * per * scale, mid1 = x0 + full * per * scale;
    if (full > shown) s += rect(mid0 + 1, 58, mid1 - mid0 - 2, 30, { fill: 'none', dash: true }) + text((mid0 + mid1) / 2, 78, `more ${p.box[1]} of ${per}…`, { size: 11, fill: SOFT });
    if (left) {
      s += rect(mid1 + 1, 58, per * scale - 2, 30, { fill: 'none', stroke: ASK, dash: true }) + rect(mid1 + 1, 58, left * scale - 2, 30, { fill: '#f3c9b4', stroke: ASK });
      s += text(x1, 106, `the last ${left} need a ${p.box[0]} too`, { size: 12, anchor: 'end', fill: ASK, weight: 700 });
    }
    s += text(x0, 106, `${p.box[1]}: ?`, { size: 13, anchor: 'start', fill: ASK, weight: 800 });
    return { svg: svg(114, s), line: left ? `Every ${p.box[0]} holds ${per}. Fill them up, and the few left over still need a ${p.box[0]}: an order is never short.` : `Every ${p.box[0]} holds ${per}. How many ${p.box[1]} of ${per} make ${total}?` };
  },
};
export const PIC_TITLES = { calendar: 'Count the days', dozen: 'A dozen', meals: 'A day at a time', pack: 'Packing the crates' };

export function picture(pic) {
  if (!pic) return { svg: '', title: '', line: '' };
  if (!DRAW[pic.kind]) return storePicture(pic);
  const { svg: s, line } = DRAW[pic.kind](pic);
  return { svg: s, title: PIC_TITLES[pic.kind] || '', line };
}
