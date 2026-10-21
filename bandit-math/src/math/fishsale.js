// SELLING FISH at the general store's counter. The fish kept off the dock (src/fishingjob.js: rider.fishing.creel, in
// the saddlebags) are bought by the townsfolk at the counter, each sale an order slip like the eggs and the wool
// (src/missions/store.js deals it; src/math/goods.js is the eggs' and wool's): the kid picks the coin with the gold it
// comes to. The fish sold are real ones from the saddlebags, with their real weights (to the eighth of a pound).
// The kinds of sale, by the rider's level (src/math/strands.js MAPS fishSaleK, fishSale, fishRate):
//   count  (Word problems 16)  by the fish: "Mr. Ames pays 3 gold for each fish. You bring 4 fish." (equal groups)
//   pound  (Fractions 36)      one fish by the pound: "Your trout weighs 3/4 of a pound. She pays 8 gold a pound."
//                              (a fraction of a number: 3/4 of 8)
//   pair   (Fractions 46)      two fish by the pound: their weights added first (the same or related bottom numbers)
//   three  (Fractions 54)      three fish by the pound, mixed numbers
//   rate   (Ratios 58)         so much gold for every 2 or 3 fish: "5 gold for every 2 fish. You bring 6." (a ratio
//                              table: 3 lots of 2, 3 × 5)
// The price a pound is picked so the gold comes out whole (a weight in eighths sells at 8 gold a pound). The wrong coins
// are the real slips: paid for a whole pound, the top number alone, only one fish, the per-lot price for every fish...
// Every answer is a whole number of gold; the picture after a miss shows the numbers to work with, never the answer.
// Pure: no page, no three.js (tests/fishing-sale.test.mjs).
//
//   makeFishSale(creel, { form, who, rand, map, at }) -> an order shaped as the store's (src/math/goods.js makeSale),
//     with .sale = { goods: 'fish', fish: [indices into creel], sold (how many), gold, form, map, strand, at }, or null
//     when the saddlebags hold too few fish for that form
//   SALE_FORMS: the forms of each map in order; FISH_SALE: the prices; formsBelow(form): the easier forms to fall back on
//   fishPicture(pic) -> { svg, title, line }   the slip's picture
import { fr, simplest, value, plus, fracText, measure, words, label, lcm } from '../../labs/fishing/frac.js';
import { fishSvg, stext, tablePic, weighPic, INK, GREEN } from '../../labs/fishing/pics.js';

export const FISH_SALE = {
  most: 4,              // fish one customer buys at most
  each: [2, 3],         // gold a fish, sold by the fish
  pound: [4, 6, 8],     // gold a pound to pick from (whichever makes the gold come out whole)
  rateGold: { 2: [3, 5, 6], 3: [4, 5, 7] },   // gold for every 2 fish, for every 3 fish
};
export const SALE_FORMS = { fishSaleK: ['count'], fishSale: ['pound', 'pair', 'three'], fishRate: ['rate'] };
export const STRAND_OF = { fishSaleK: 'words', fishSale: 'frac', fishRate: 'ratio' };
const ORDER = ['count', 'pound', 'pair', 'three'];
// the easier forms to fall back on when the saddlebags hold too few fish (a pair needs two): the form itself first
export const formsBelow = (form) => (form === 'rate' ? ['rate', 'pair', 'pound', 'count'] : ORDER.slice(0, ORDER.indexOf(form) + 1).reverse());
export const mapOfForm = (form) => Object.keys(SALE_FORMS).find((m) => SALE_FORMS[m].includes(form));

const NAMES = { perch: ['perch', 'perch'], trout: ['trout', 'trout'], bass: ['bass', 'bass'], catfish: ['catfish', 'catfish'] };
const COLOURS = { perch: '#d2a93a', trout: '#7d8a4e', bass: '#5f7d3a', catfish: '#7a7268' };
const GOLD = ['gold', 'gold'];
const whole = (f) => f.n % f.d === 0;
const lbOf = (fish) => simplest({ n: fish.lb.n, d: fish.lb.d });
const T = (f) => fracText(f);
const lbWords = (f) => words(measure(f, 'lb'));
const lbLabel = (f) => label(measure(f, 'lb'));
const fishN = (n) => `${n} fish`;

// a fish as the saddlebags keep it: { kind, len, lb } (measures), or null if it isn't one
export function cleanFish(f) {
  const m = (x, units) => (x && Number.isInteger(+x.n) && +x.n > 0 && Number.isInteger(+x.d) && +x.d > 0 && units.includes(x.unit) ? { n: +x.n, d: +x.d, unit: x.unit, form: x.form === 'frac' ? 'frac' : 'mixed' } : null);
  if (!f || typeof f !== 'object' || !NAMES[f.kind]) return null;
  const len = m(f.len, ['ft', 'in']), lb = m(f.lb, ['lb']);
  return len && lb ? { kind: f.kind, len, lb } : null;
}

// the coins: the right one and up to 3 slips, shuffled (null: not enough different wrong ones)
function coinsFor(answer, slips, rand, n = 4) {
  const used = new Set([answer]), wrong = [];
  for (const s of slips) {
    if (wrong.length >= n - 1) break;
    if (!Number.isInteger(s.v) || s.v <= 0 || s.v > 999 || used.has(s.v)) continue;
    used.add(s.v); wrong.push({ v: s.v, big: String(s.v), small: 'gold', label: `${s.v} gold`, good: false, slip: s.slip, why: s.why });
  }
  // (too few designed slips: near misses fill in, each with a plain reason)
  for (let d = 1; wrong.length < n - 1 && d < 40; d++) for (const v of [answer + d, answer - d]) {
    if (wrong.length >= n - 1 || v <= 0 || used.has(v)) continue;
    used.add(v); wrong.push({ v, big: String(v), small: 'gold', label: `${v} gold`, good: false, slip: 'near', why: `Not quite: ${v > answer ? 'a little too much' : 'a little short'}. Work it through again.` });
  }
  const coins = [{ v: answer, big: String(answer), small: 'gold', label: `${answer} gold`, good: true, slip: null, why: '' }, ...wrong];
  for (let i = coins.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [coins[i], coins[j]] = [coins[j], coins[i]]; }
  return coins;
}
// prices a pound that make the gold whole for a weight with this bottom number
const poundPrices = (d) => FISH_SALE.pound.filter((p) => p % d === 0);
const pick = (a, rand) => a[Math.floor(rand() * a.length) % a.length];

// indices of up to k fish, the newest first, whose weights suit the form (wanted(f) -> true)
function choose(creel, k, ok, rand) {
  const idx = creel.map((f, i) => i).filter((i) => ok(creel[i])).reverse();
  if (idx.length < k) return null;
  // (the newest few, a little shuffled, so the same fish aren't always the ones bought)
  const pool = idx.slice(0, Math.max(k, Math.min(idx.length, k + 2)));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, k).sort((a, b) => a - b);
}

// ── the forms ────────────────────────────────────────────────────────────────────────────────────────────────────────
function countCore(creel, { rand, f }) {
  const n = Math.min(creel.length, FISH_SALE.most); if (n < 1) return null;
  const idx = creel.map((x, i) => i).slice(-n), p = pick(FISH_SALE.each, rand), ans = n * p, She = f.she ? 'She' : 'He';
  return {
    idx, answer: ans,
    story: `${f.name} wants to buy your fish. ${She} pays ${p} gold for each fish. You bring ${fishN(n)}.`,
    slips: [
      { v: n + p, slip: 'added', why: `${n} + ${p} adds them. Each fish is ${p} gold: ${n} groups of ${p}.` },
      { v: p, slip: 'one', why: `${p} gold is for 1 fish. You bring ${n}.` },
      { v: n, slip: 'count', why: `${n} is how many fish. Each one is ${p} gold.` },
      { v: (n + 1) * p, slip: 'off', why: `That's ${n + 1} fish. Count again: ${n}.` },
      { v: (n - 1) * p, slip: 'off', why: `That's only ${n - 1} fish. You bring ${n}.` },
    ],
    pic: { kind: 'each', fish: idx.map((i) => creel[i].kind), price: p },
    rightWhy: `${fishN(n)} × ${p} gold = ${ans} gold`,
  };
}
function poundCore(creel, { rand, f }) {
  // (a weight in halves, quarters or eighths: one of the prices splits into that many parts. A fish of 7/12 of a pound
  // has no such price, and its slip once read "She pays undefined gold a pound": with no fish that fits, no pound sale)
  const ok = (x) => { const w = lbOf(x); return !whole(w) && [2, 4, 8].includes(w.d) && value(w) <= 3; };
  const idx = choose(creel, 1, ok, rand) || choose(creel, 1, (x) => { const w = lbOf(x); return !whole(w) && [2, 4, 8].includes(w.d); }, rand);
  if (!idx) return null;
  const fish = creel[idx[0]], w = lbOf(fish), p = pick(poundPrices(w.d), rand), ans = Math.round(value(w) * p);
  const W = Math.floor(value(w)), a = w.n - W * w.d, part = p / w.d, She = f.she ? 'She' : 'He';
  const slips = [{ v: p, slip: 'wholePound', why: `${p} gold is the price of a whole pound. Your ${NAMES[fish.kind][0]} weighs ${lbWords(w)}.` }];
  if (a > 0) slips.push({ v: a * p, slip: 'topTimes', why: `${a} × ${p} pays for ${a} whole pounds. Split the ${p} gold into ${w.d} equal parts first: ${p} ÷ ${w.d} = ${part} for each ${w.d === 2 ? 'half' : w.d === 4 ? 'quarter' : 'eighth'} of a pound.` });
  if (a > 1) slips.push({ v: W * p + part, slip: 'onePart', why: `${part} gold is one ${w.d === 2 ? 'half' : w.d === 4 ? 'quarter' : 'eighth'} of a pound's price. The fish has ${a} of those parts${W ? ` on top of ${W} whole pound${W > 1 ? 's' : ''}` : ''}.` });
  if (W > 0 && a > 0) slips.push({ v: W * p, slip: 'wholeOnly', why: `That pays only for the ${W} whole pound${W > 1 ? 's' : ''}. Add the ${a}/${w.d} of a pound too.` });
  slips.push({ v: p * w.d, slip: 'timesBottom', why: `${p} × ${w.d} multiplies by the bottom number. The bottom number says how many equal parts a pound is cut into: divide the ${p} gold into ${w.d} parts.` });
  if (value(w) !== 0.5 && p % 2 === 0) slips.push({ v: p / 2, slip: 'half', why: `${p / 2} gold is the price of half a pound. Your ${NAMES[fish.kind][0]} weighs ${lbWords(w)}.` });
  slips.push({ v: p + a, slip: 'added', why: `Adding the numbers doesn't do it. It's ${T(w)} of ${p} gold: ${p} ÷ ${w.d}, times ${w.n}.` });
  return {
    idx, answer: ans,
    story: `${f.name} wants to buy your ${NAMES[fish.kind][0]}. It weighs ${lbWords(w)}. ${She} pays ${p} gold a pound.`,
    slips,
    pic: { kind: 'pound', fish: [{ kind: fish.kind, w }], price: p, parts: w.d },
    rightWhy: `${p} gold ÷ ${w.d} = ${part} gold for each ${w.d === 2 ? 'half' : w.d === 4 ? 'quarter' : 'eighth'} of a pound; ${T(w)} pounds is ${w.n} of them: ${w.n} × ${part} = ${ans} gold`,
  };
}
function sumCore(creel, k, { rand, f, mixed }) {
  // fish whose weights add up to something the prices can pay whole: bottom numbers 1, 2, 4 or 8
  const ok = (x) => { const w = lbOf(x); return [1, 2, 4, 8].includes(w.d) && value(w) <= (mixed ? 3 : 1.5); };
  for (let t = 0; t < 8; t++) {
    const idx = choose(creel, k, ok, rand); if (!idx) return null;
    const ws = idx.map((i) => lbOf(creel[i])), s = ws.reduce((a, b) => plus(a, b), fr(0));
    if (!mixed && ws.every((w) => w.d === 1)) continue;
    // (a price each part of a pound gets a whole number of gold from: the picture cuts the pound into those parts)
    const D = ws.reduce((d, w) => lcm(d, w.d), 1), ps = poundPrices(D); if (!ps.length) continue;
    const p = pick(ps, rand), ans = Math.round(value(s) * p), She = f.she ? 'She' : 'He';
    const names = idx.map((i) => NAMES[creel[i].kind][0]);
    const list = ws.map((w, j) => `a ${names[j]} of ${lbWords(w)}`);
    const listText = list.length === 2 ? `${list[0]} and ${list[1]}` : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
    const tops = ws.reduce((a, w) => a + w.n, 0), bots = ws.reduce((a, w) => a + w.d, 0);
    const slips = [
      { v: Math.round(value(ws[0]) * p), slip: 'oneFish', why: `That's only the ${names[0]}. ${She} buys ${k === 2 ? 'both' : `all ${k}`}: add the weights first.` },
      { v: p * k, slip: 'byFish', why: `That pays ${p} gold a fish. The price is ${p} gold a pound: add the weights first.` },
      { v: Math.round(tops / bots * p), slip: 'topsBottoms', why: `Adding the tops and the bottoms doesn't add fractions. Give them the same bottom number (${D}) and add the tops.` },
      { v: s.n * p, slip: 'topTimes', why: `${s.n} × ${p} forgets the bottom number: ${T(s)} pounds is not ${s.n} pounds.` },
      { v: ans + p, slip: 'extraPound', why: `That's a pound too many. Together they weigh ${lbWords(s)}.` },
      { v: ans - p, slip: 'shortPound', why: `That's a pound short. Together they weigh ${lbWords(s)}.` },
    ];
    const add = ws.map((w) => (w.d === D ? T(w) : `${T(w)} = ${T({ n: w.n * D / w.d, d: D })}`)).join(', ');
    return {
      idx, answer: ans,
      story: `${f.name} wants to buy ${k === 2 ? 'two' : 'three'} of your fish: ${listText}. ${She} pays ${p} gold a pound.`,
      slips,
      pic: { kind: 'pound', fish: idx.map((i, j) => ({ kind: creel[i].kind, w: ws[j] })), price: p, parts: D },
      rightWhy: `In ${D === 1 ? 'whole pounds' : `${D === 2 ? 'halves' : D === 4 ? 'quarters' : 'eighths'}`}: ${add}. Together ${T(s)} pounds, and ${T(s)} × ${p} gold = ${ans} gold`,
    };
  }
  return null;
}
function rateCore(creel, { rand, f }) {
  const have = Math.min(creel.length, 6);
  for (const F of rand() < 0.5 ? [2, 3] : [3, 2]) {
    const lots = Math.floor(have / F); if (lots < 2) continue;
    const n = lots * F, G = pick(FISH_SALE.rateGold[F], rand), ans = lots * G, She = f.she ? 'She' : 'He';
    const idx = creel.map((x, i) => i).slice(-n);
    return {
      idx, answer: ans,
      story: `${f.name} wants to buy your fish. ${She} pays ${G} gold for every ${F} fish. You bring ${fishN(n)}.`,
      slips: [
        { v: n * G, slip: 'perFish', why: `That pays ${G} gold for every fish. It's ${G} gold for every ${F}: first see how many lots of ${F} there are.` },
        { v: G, slip: 'oneLot', why: `${G} gold is for just ${F} fish. You bring ${n}.` },
        { v: lots, slip: 'lotsOnly', why: `${lots} is how many lots of ${F}. Each lot is ${G} gold.` },
        { v: n + G, slip: 'added', why: `${n} + ${G} adds them. Find the lots of ${F}, then ${G} gold for each.` },
        { v: (lots + 1) * G, slip: 'oneMore', why: `That's ${lots + 1} lots of ${F}. ${n} fish make ${lots}.` },
      ],
      pic: { kind: 'rate', F, G, n },
      rightWhy: `${n} fish ÷ ${F} = ${lots} lots, and ${lots} × ${G} gold = ${ans} gold`,
    };
  }
  return null;
}

// one sale. creel: the saddlebags' fish; form: 'count' | 'pound' | 'pair' | 'three' | 'rate'; who: { name, she }
export function makeFishSale(creel, { form = 'count', who = null, rand = Math.random, map = null, at = null } = {}) {
  creel = (creel || []).map(cleanFish).filter(Boolean);
  if (!creel.length) return null;
  const f = who || { name: 'A customer', she: false };
  const make = () => (form === 'pound' ? poundCore(creel, { rand, f }) : form === 'pair' ? sumCore(creel, 2, { rand, f, mixed: false })
    : form === 'three' ? sumCore(creel, 3, { rand, f, mixed: true }) : form === 'rate' ? rateCore(creel, { rand, f }) : form === 'count' ? countCore(creel, { rand, f }) : null);
  // (the picture shows the numbers to work with, never the answer: a sale whose picture would show it is dealt again)
  let core = null;
  for (let t = 0; t < 10; t++) { const c = make(); if (!c) break; core = c; if (form === 'count' || !shownNumbers(c.pic).includes(c.answer)) break; }
  if (!core) return null;
  const coins = coinsFor(core.answer, core.slips, rand);
  const m = map || mapOfForm(form);
  const ask = 'How much gold do you get?';
  return {
    id: Math.floor(rand() * 1e9).toString(36), type: 'sale', step: 1, key: `sale:fish:${form}`, who: f,
    story: core.story, ask, read: `${core.story} ${ask}`, coins, answer: coins.find((c) => c.good).label, unit: GOLD, cents: false,
    pic: core.pic, rightWhy: core.rightWhy, afterWhy: '', equation: null, picture: fishPicture,
    sale: { goods: 'fish', fish: core.idx, sold: core.idx.length, gold: core.answer, form, map: m, strand: STRAND_OF[m] || 'words', at },
    credit: form === 'rate' ? [{ strand: 'div', at: 33, weight: 0.5 }] : form === 'count' ? [{ strand: 'mul', at: 18, weight: 0.5 }] : [], size: 1,
  };
}

// ── the slip's picture (after a miss): the numbers to work with, never the answer ──────────────────────────────────
// every whole number the picture and its line show (fractions' tops and bottoms too)
export const shownNumbers = (pic) => { const p = fishPicture(pic), t = (p.svg.match(/>([^<]*)</g) || []).join(' ') + ' ' + p.line; return (t.match(/\d+/g) || []).map(Number); };
const svgOf = (h, s) => `<svg class="pic" viewBox="0 0 320 ${h}">${s}</svg>`;
export function fishPicture(pic) {
  if (!pic) return { svg: '', title: '', line: '' };
  if (pic.kind === 'each') {
    const n = pic.fish.length, w = Math.min(70, 300 / n); let s = '';
    pic.fish.forEach((k, i) => {
      const x = 10 + i * w; s += fishSvg(x + 4, x + w - 6, 26, COLOURS[k] || '#7d8a4e', 14);
      s += stext(x + w / 2, 62, `${pic.price} gold`, { size: 14, fill: '#8a5a28' });
    });
    return { svg: svgOf(74, s), title: 'Equal groups', line: `${n} fish, ${pic.price} gold each: that's ${n} groups of ${pic.price}.` };
  }
  if (pic.kind === 'pound') {
    // the weights end to end on a pound scale, cut into the shared parts (each pound's price written on it)
    const ws = pic.fish.map((x) => x.w), D = pic.parts;
    let svg;
    if (ws.length === 2) svg = weighPic({ f: ws[0], label: lbLabel(ws[0]), colour: COLOURS[pic.fish[0].kind] }, { f: ws[1], label: lbLabel(ws[1]), colour: COLOURS[pic.fish[1].kind] }, { parts: D, total: 'together: add them' });
    else {
      // one fish, or three: a bar a pound long cut into parts, the weights shaded along it
      const sum = ws.reduce((a, b) => a + value(b), 0), wholeN = Math.max(1, Math.ceil(sum - 1e-9)), X0 = 18, X1 = 302, sx = (X1 - X0) / wholeN, y = 40, h = 26;
      let s = `<rect x="${X0}" y="${y}" width="${X1 - X0}" height="${h}" fill="#fffaf0" stroke="${INK}" stroke-width="1.4"/>`, x = X0;
      ws.forEach((w, i) => { const dx = value(w) * sx; s += `<rect x="${x.toFixed(1)}" y="${y}" width="${dx.toFixed(1)}" height="${h}" fill="${COLOURS[pic.fish[i].kind]}" opacity="0.85"/>`; s += stext(x + dx / 2, y - 8, lbLabel(w), { size: 13 }); x += dx; });
      for (let k = 1; k < D * wholeN; k++) { const lx = (X0 + k / D * sx).toFixed(1), big = k % D === 0; s += `<line x1="${lx}" y1="${y}" x2="${lx}" y2="${y + h}" stroke="${INK}" stroke-width="${big ? 2.6 : 1}"/>`; }
      s += `<rect x="${X0}" y="${y}" width="${X1 - X0}" height="${h}" fill="none" stroke="${INK}" stroke-width="1.6"/>`;
      for (let k = 0; k <= wholeN; k++) s += stext(X0 + k * sx, y + h + 15, k + (k === wholeN ? ' lb' : ''), { size: 13, fill: '#5a4632' });
      for (let k = 0; k < wholeN; k++) s += stext(X0 + (k + 0.5) * sx, y + h + 34, `${pic.price} gold a pound`, { size: 12, fill: GREEN });
      svg = svgOf(y + h + 44, s);
    }
    return { svg, title: 'By the pound', line: D > 1 ? `Each pound is cut into ${D} equal parts, and a pound is ${pic.price} gold. What is one part worth? Then count the parts.` : `${pic.price} gold for every pound.` };
  }
  if (pic.kind === 'rate') {
    return { svg: tablePic({ head: ['fish', 'gold'], rows: [[pic.F, pic.G], [pic.n, '?']], steps: [`× ${pic.n / pic.F}`] }), title: 'A ratio table', line: `${pic.G} gold for every ${pic.F} fish. How many lots of ${pic.F} in ${pic.n}? Then multiply.` };
  }
  return { svg: '', title: '', line: '' };
}
