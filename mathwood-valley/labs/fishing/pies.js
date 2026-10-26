// FRACTIONS OFF THE FISH: the dock's questions that aren't about the fish on the line (the agreed design, 2026-10-21:
// "it doesn't always have to be about the fish you caught": Pam's pie with a slice missing, a third of your fish for
// Tom). Each still comes with the caught fish (the card's head shows it, and it goes into the creel after), and each
// has the dock's question shape (questions.js: prompt, choices, labels, answer, why, helper, svg, rule, steps,
// lessonPic, answerLabel, action, key, topic).
//   slices   a pie pan cut in 2, 4 (or 3, 6, 8) slices, some there: how much pie? (counting slices: 3/4)
//   word     one slice of a pie cut in 3: a third, a half or a quarter?
//   same     two pies drawn, 2/4 and 1/2: the same amount? (yes or no)
//   group    a fraction of the fish you caught for Tom: one third of 9 (then two thirds)
//   left     Pam's pie cut in 8, 3 slices gone: what fraction is left?
//   timesW   4 perch of 3/4 of a pound each: how much in all?
//   take     3/4 of a pie, 1/3 of a pie sold: how much is left? (different bottom numbers)
//   times    the cat ate 2/3 of your 3/4-pound perch: how much did it eat?
//   divide   3 pounds of catfish cut in 1/4-pound pieces: how many pieces?
// And THE LEVELS (src/levels/place/fishing.js): questionAt(gen, rnd, ctx, recent) makes the question at a level's gen,
// the ONE maker for the dock and the levels page: { kind: 'fish', from, topic } is the dock's own (questions.js
// questionFor: keep or throw, line-ups, weights added, equal fractions, unlike bottom numbers, mixed numbers), any other
// kind is one of the above. lessonAt(gen, rnd) a fresh one of the same kind for "Teach me" and "Try it".
// Pure: no page (node tests).
import { fr, gcd, simplest, value, same, plus, minus, fracText, partsWord } from './frac.js';
import { stext, INK, RED, GREEN, fishSvg } from './pics.js';
import { questionFor, questionOf, keeperFish, KINDS } from './questions.js';

const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length) % arr.length];
const int = (a, b, rnd) => a + Math.floor(rnd() * (b - a + 1));
const shuffle = (arr, rnd) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
const T = (f) => fracText(simplest(f));
const r1 = (v) => Math.round(v * 10) / 10;
const ONE_WORD = { 2: 'a half', 3: 'a third', 4: 'a quarter', 5: 'a fifth', 6: 'a sixth', 8: 'an eighth' };
const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const PIE = '#d9a05b', CRUST = '#8a5a2b', PAN = '#c9c4ba';

// ── the pictures ────────────────────────────────────────────────────────────────────────────────────────────────────
// a pie pan at (cx, cy), cut in d equal slices: the slices in `have` (indices) are pie, the rest an empty pan with a
// dashed edge; shade: indices drawn darker (the slice the question points at)
function pieAt(cx, cy, R, d, have, { shade = [], label = '' } = {}) {
  let s = `<circle cx="${cx}" cy="${cy}" r="${R + 3}" fill="${PAN}" stroke="${INK}" stroke-width="1.4"/>`;
  for (let i = 0; i < d; i++) {
    const a0 = -Math.PI / 2 + (i / d) * Math.PI * 2, a1 = -Math.PI / 2 + ((i + 1) / d) * Math.PI * 2;
    const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0), x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
    const path = d === 1 ? `M${cx - R} ${cy}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0` : `M${cx} ${cy}L${r1(x0)} ${r1(y0)}A${R} ${R} 0 ${1 / d > 0.5 ? 1 : 0} 1 ${r1(x1)} ${r1(y1)}Z`;
    const there = have.includes(i);
    s += `<path d="${path}" fill="${there ? (shade.includes(i) ? '#b8742f' : PIE) : '#ece7dc'}" stroke="${there ? CRUST : '#9a948a'}" stroke-width="${there ? 1.6 : 1.1}"${there ? '' : ' stroke-dasharray="4 3"'}/>`;
  }
  if (label) s += stext(cx, cy + R + 24, label, { size: 17 });
  return s;
}
function piesPic(pies, { h = 150 } = {}) {
  const n = pies.length, R = Math.min(52, 300 / n / 2 - 14), gap = 320 / n;
  return `<svg class="pic" viewBox="0 0 320 ${h}">${pies.map((p, i) => pieAt(r1(gap * (i + 0.5)), 62, R, p.d, p.have, p)).join('')}</svg>`;
}
const firstN = (n) => [...Array(n).keys()];
// the fish you caught, in d groups of k (the groups boxed): a fraction of a group, drawn
function shareFishPic({ k, d, colour = '#7d8a4e', mark = 0 }) {
  const fishW = 20, gw = k * (fishW + 2) + 8, perRow = Math.max(1, Math.floor(310 / (gw + 8))), rows = Math.ceil(d / perRow), H = rows * 36 + 8;
  let s = '';
  for (let g = 0; g < d; g++) {
    const gx = 6 + (g % perRow) * (gw + 8), gy = 6 + Math.floor(g / perRow) * 36, on = g < mark;
    s += `<rect x="${gx}" y="${gy}" width="${gw}" height="28" rx="6" fill="${on ? '#e7f0d8' : 'none'}" stroke="${on ? GREEN : INK}" stroke-width="${on ? 1.8 : 1}" stroke-dasharray="${on ? '' : '3 2'}" opacity="0.85"/>`;
    for (let i = 0; i < k; i++) { const x = gx + 5 + i * (fishW + 2); s += fishSvg(x, x + fishW - 2, gy + 14, on ? colour : '#b9ab90', 6); }
  }
  return `<svg class="pic" viewBox="0 0 320 ${H}">${s}</svg>`;
}

// ── the questions ───────────────────────────────────────────────────────────────────────────────────────────────────
// choices: the right one and up to `n - 1` wrong ones, each a different amount from the right one (and each other)
function fracChoices(answer, wrong, rnd, n = 4, { exact = false } = {}) {
  const out = [];
  for (const w of wrong) {
    if (!w || w.n <= 0 || w.d <= 0) continue;
    const clash = exact ? out.some((o) => o.n === w.n && o.d === w.d) || (w.n === answer.n && w.d === answer.d) : out.some((o) => same(o, w)) || same(w, answer);
    if (!clash) out.push(w);
  }
  return shuffle([answer, ...out.slice(0, n - 1)], rnd);
}
const asText = (f, exact) => (exact ? `${f.n}/${f.d}` : T(f));
function shape({ topic, key, prompt, answer, choices, exact = false, why, steps, rule, svg = '', helper = '', lessonPic = '', fish, unit = '' }) {
  const labels = choices.map((f) => (typeof f === 'string' ? f : asText(f, exact) + unit));
  const keys = choices.map((f) => (typeof f === 'string' ? f : asText(f, exact)));
  const ans = typeof answer === 'string' ? answer : asText(answer, exact);
  return { topic, key, fish, prompt, choices: keys, labels, answer: ans, action: 'keep', why, helper: helper || svg, svg, lessonPic: lessonPic || helper || svg,
    rule, steps, answerLabel: (typeof answer === 'string' ? answer : asText(answer, exact)) + unit };
}

const MAKE = {
  // a pie pan cut in d slices, n of them there: how much pie? (counting the slices; 4/4 is the whole pie)
  slices(g, rnd, ctx) {
    const d = pick(g.den, rnd), n = int(1, d, rnd), fish = keeperFish(rnd, ctx.counts);
    const ans = fr(n, d);
    const wrong = [fr(d - n, d), fr(d, n), fr(n, d + 1), fr(n + 1, d), fr(n - 1, d)].filter((f) => f.n > 0 && f.n <= f.d * 2);
    const choices = fracChoices(ans, wrong, rnd, g.choices || 3, { exact: true });
    const svg = piesPic([{ d, have: firstN(n) }]);
    const why = `The pan is cut in ${d} equal slices, and ${n} ${n === 1 ? 'is' : 'are'} there: ${n}/${d}${n === d ? ', the whole pie' : ''}.`;
    return shape({ topic: 'slices', key: `slices:${n}/${d}`, fish, exact: true, svg, answer: ans, choices,
      prompt: `Pam wants to trade a pie for your ${KINDS[fish.kind].one}. Her pan is cut in ${d} equal slices. How much pie is in it?`,
      why, steps: [`Count all the slices the pan is cut in: ${d}. That's the bottom number.`, `Count the slices still there: ${n}. That's the top number.`, `${n}/${d}.`],
      rule: 'The bottom number says how many equal slices the whole pie is cut in; the top number says how many there are.' });
  },
  // one slice of a pie cut in d: what is it called?
  word(g, rnd, ctx) {
    const d = pick(g.den, rnd), fish = keeperFish(rnd, ctx.counts);
    const opts = shuffle([d, ...shuffle(g.den.filter((x) => x !== d), rnd).slice(0, 2)], rnd);
    const lab = (x) => `${ONE_WORD[x]} (1/${x})`;
    const svg = piesPic([{ d, have: firstN(d), shade: [0] }]);
    return { ...shape({ topic: 'word', key: `word:${d}`, fish, svg, answer: lab(d), choices: opts.map(lab),
      prompt: `Pam cut her pie in ${d} equal slices. What is one slice called?`,
      why: `${d} equal slices: each one is ${ONE_WORD[d]} of the pie, 1/${d}.`,
      steps: [`The pie is cut in ${d} equal slices.`, `One of ${d} equal parts is ${ONE_WORD[d]}: 1/${d}.`],
      rule: 'Two equal parts are halves, three are thirds, four are quarters. One part is 1 over that number.' }) };
  },
  // two pies of the same size, n/d and m/(d k): the same amount? yes or no
  same(g, rnd, ctx) {
    const d = pick([2, 3, 4], rnd), k = pick([2, 2, 3], rnd), n = int(1, d - 1, rnd), D = d * k, fish = keeperFish(rnd, ctx.counts);
    const yes = rnd() < 0.5;
    let m = n * k; if (!yes) m = m + pick([-1, 1], rnd) * (m === 1 ? -1 : 1);
    if (m <= 0 || m >= D) m = n * k + 1;
    const isSame = m === n * k;
    const svg = piesPic([{ d, have: firstN(n), label: `${n}/${d}` }, { d: D, have: firstN(m), label: `${m}/${D}` }], { h: 160 });
    const why = isSame ? `Yes: each slice of ${n}/${d} is cut into ${k}, so ${n}/${d} is ${n * k}/${D}, the same amount of pie.` : `No: ${n}/${d} is the same as ${n * k}/${D}, and ${m}/${D} is ${m < n * k ? 'less' : 'more'}.`;
    return shape({ topic: 'same', key: `samepie:${n}/${d}:${m}/${D}`, fish, svg, answer: isSame ? 'Yes' : 'No', choices: ['Yes', 'No'],
      prompt: `Two pies the same size: Pam's has ${n}/${d} left and Tom's has ${m}/${D} left. Is ${m}/${D} the same amount as ${n}/${d}?`,
      why, steps: [`Cut each slice of the ${n}/${d} pie into ${k}: it has ${n * k} small slices of ${D}.`, isSame ? `${m}/${D} has just as many: the same amount.` : `${m}/${D} has ${m}, not ${n * k}: not the same.`],
      rule: 'Two fractions are the same amount when the pies match: cutting every slice in two (or three) doubles (or triples) both numbers.' });
  },
  // a fraction of the fish you caught: one third of 9 (unit), then two thirds of 9
  group(g, rnd, ctx) {
    const d = pick(g.den, rnd), k = int(2, g.most || 5, rnd), all = d * k, fish = keeperFish(rnd, ctx.counts);
    let n = g.unit ? 1 : int(2, d - 1, rnd); if (n >= d) n = 1;
    if (gcd(n, d) > 1) n = 1;
    const ans = n * k, frac = n === 1 ? (d === 2 ? 'half' : ONE_WORD[d]) : `${NUM[n]} ${partsWord(d)}`;
    const wrong = [k * (n === 1 ? 2 : 1), d, all - ans, ans + 1, n + d, all / n].filter((v) => Number.isInteger(v) && v > 0 && v !== ans);
    const opts = shuffle([ans, ...[...new Set(wrong)].slice(0, 3)], rnd).map(String);
    const svg = shareFishPic({ k, d, colour: KINDS[fish.kind].colour }), helper = shareFishPic({ k, d, colour: KINDS[fish.kind].colour, mark: n });
    const who = pick(['Tom', 'Rosa', 'Sam', 'Clara'], rnd);
    return shape({ topic: 'group', key: `group:${n}/${d}:${all}`, fish, svg, helper, answer: String(ans), choices: opts,
      prompt: `You caught ${all} fish today and promised ${who} ${frac} of them (${n}/${d}). How many fish does ${who} get?`,
      why: `Put the ${all} fish in ${d} equal groups: ${all} ÷ ${d} = ${k} in each. ${n === 1 ? `One group is ${k}.` : `${NUM[n][0].toUpperCase() + NUM[n].slice(1)} groups: ${n} × ${k} = ${ans}.`}`,
      steps: [`The bottom number, ${d}: share the ${all} fish into ${d} equal groups, ${k} in each.`, `The top number, ${n}: take ${n} group${n > 1 ? 's' : ''}: ${ans} fish.`],
      rule: 'To find a fraction of a group: share it into as many equal groups as the bottom number, then take as many groups as the top number.' });
  },
  // what's left of a pie: cut in d, `gone` slices gone (the slices counted, not made simpler)
  left(g, rnd, ctx) {
    const d = pick(g.den, rnd), gone = int(1, d - 1, rnd), n = d - gone, fish = keeperFish(rnd, ctx.counts);
    const ans = fr(n, d), wrong = [fr(gone, d), fr(n, gone), fr(d, n), fr(n + 1, d), fr(n - 1, d)].filter((f) => f.n > 0);
    const choices = fracChoices(ans, wrong, rnd, 4, { exact: true }).filter((f, i, a) => !(f !== ans && same(f, ans)));
    const svg = piesPic([{ d, have: firstN(n) }]);
    return shape({ topic: 'left', key: `left:${gone}/${d}`, fish, exact: true, svg, answer: ans, choices,
      prompt: `Pam wants to trade a pie for your ${KINDS[fish.kind].one}, but her children ate ${gone} of its ${d} slices. What fraction of the pie is left?`,
      why: `${d} slices in the whole pie, ${gone} gone: ${d} − ${gone} = ${n} left, so ${n}/${d}.`,
      steps: [`The whole pie: ${d}/${d}.`, `Take away the ${gone} slices gone: ${d} − ${gone} = ${n}.`, `${n}/${d} of the pie is left.`],
      rule: 'A whole pie cut in d slices is d/d. Take away the slices gone from the top number; the bottom number stays.' });
  },
  // a whole number of fish times a fraction of a pound each
  timesW(g, rnd, ctx) {
    const d = pick([2, 3, 4, 8], rnd), n = int(1, d - 1, rnd), w = int(2, 6, rnd), fish = keeperFish(rnd, ctx.counts);
    if (gcd(n, d) > 1) return null;
    const ans = simplest(fr(n * w, d));
    const wrong = [fr(n * w, d * w), fr(n, d * w), fr(w * d + n, d), fr(n + w, d)];
    const choices = fracChoices(ans, wrong, rnd);
    const kind = KINDS[fish.kind].one;
    return shape({ topic: 'timesW', key: `timesW:${w}x${n}/${d}`, fish, answer: ans, choices, unit: ' lb',
      prompt: `You have ${w} ${kind} in your creel, each weighing ${n}/${d} of a pound. How much do they weigh in all?`,
      why: `${w} × ${n}/${d} = ${n * w}/${d}${ans.d === d && ans.n === n * w ? '' : ` = ${T(ans)}`}: ${T(ans)} ${value(ans) > 1 ? 'pounds' : 'of a pound'} in all.`,
      steps: [`${w} × ${n}/${d} means ${w} lots of ${n}/${d}.`, `Multiply the top number: ${w} × ${n} = ${n * w}. The bottom stays ${d}: ${n * w}/${d}.`, `${n * w}/${d} = ${T(ans)}.`],
      rule: 'A whole number times a fraction: multiply the top number, keep the bottom number.' });
  },
  // a fraction of a pie, less a fraction with another bottom number
  take(g, rnd, ctx) {
    const ds = [2, 3, 4, 6, 8], d1 = pick(ds, rnd), d2 = pick(ds.filter((x) => x !== d1), rnd), n1 = int(1, d1 - 1, rnd), n2 = int(1, d2 - 1, rnd);
    const a = fr(n1, d1), b = fr(n2, d2), fish = keeperFish(rnd, ctx.counts);
    if (gcd(n1, d1) > 1 || gcd(n2, d2) > 1 || value(a) <= value(b)) return null;
    const ans = minus(a, b), D = d1 * d2 / gcd(d1, d2);
    const wrong = [fr(Math.abs(n1 - n2), Math.abs(d1 - d2) || 1), fr(Math.abs(n1 - n2), D), fr(n1 - n2 > 0 ? n1 - n2 : n2 - n1, d1), plus(a, b)];
    const choices = fracChoices(ans, wrong, rnd);
    return shape({ topic: 'take', key: `take:${n1}/${d1}-${n2}/${d2}`, fish, answer: ans, choices, unit: ' of a pie',
      prompt: `Pam has ${n1}/${d1} of a pie left. She sells ${n2}/${d2} of a pie to Tom. How much pie is left?`,
      why: `Over ${D}ths: ${n1}/${d1} = ${(n1 * D) / d1}/${D} and ${n2}/${d2} = ${(n2 * D) / d2}/${D}. ${(n1 * D) / d1} − ${(n2 * D) / d2} = ${(n1 * D) / d1 - (n2 * D) / d2}, so ${(n1 * D) / d1 - (n2 * D) / d2}/${D}${T(ans) !== `${(n1 * D) / d1 - (n2 * D) / d2}/${D}` ? ` = ${T(ans)}` : ''}.`,
      steps: [`The bottom numbers differ: write both over ${D}.`, `${n1}/${d1} = ${(n1 * D) / d1}/${D}, ${n2}/${d2} = ${(n2 * D) / d2}/${D}.`, `Take away the tops: ${T(ans)}.`],
      rule: 'To take away fractions, first write them with the same bottom number; then take away the top numbers.' });
  },
  // a fraction of a fraction: multiply tops, multiply bottoms
  times(g, rnd, ctx) {
    const ds = [2, 3, 4, 5, 6, 8], d1 = pick(ds, rnd), d2 = pick(ds, rnd), n1 = int(1, d1 - 1, rnd), n2 = int(1, d2 - 1, rnd), fish = keeperFish(rnd, ctx.counts);
    if (gcd(n1, d1) > 1 || gcd(n2, d2) > 1) return null;
    const ans = simplest(fr(n1 * n2, d1 * d2));
    const wrong = [fr(n1 + n2, d1 + d2), simplest(fr(n1 * d2, d1 * n2)), fr(n1 * n2, d1 + d2), fr(n1 + n2, d1 * d2)];
    const choices = fracChoices(ans, wrong, rnd);
    const kind = KINDS[fish.kind].one;
    return shape({ topic: 'times', key: `times:${n1}/${d1}x${n2}/${d2}`, fish, answer: ans, choices, unit: ' lb',
      prompt: `Tom's cat ate ${n1}/${d1} of your ${n2}/${d2}-pound ${kind}. How much did the cat eat?`,
      why: `${n1}/${d1} of ${n2}/${d2} is ${n1}/${d1} × ${n2}/${d2} = ${n1 * n2}/${d1 * d2}${T(ans) !== `${n1 * n2}/${d1 * d2}` ? ` = ${T(ans)}` : ''} of a pound.`,
      steps: [`"Of" means times: ${n1}/${d1} × ${n2}/${d2}.`, `Tops: ${n1} × ${n2} = ${n1 * n2}. Bottoms: ${d1} × ${d2} = ${d1 * d2}.`, `${n1 * n2}/${d1 * d2} = ${T(ans)}.`],
      rule: 'A fraction of a fraction: multiply the top numbers and multiply the bottom numbers.' });
  },
  // how many 1/d (or n/d) pieces in w pounds
  divide(g, rnd, ctx) {
    const d = pick([2, 3, 4, 6, 8], rnd), n = rnd() < 0.6 ? 1 : int(2, d - 1, rnd), w = int(2, 6, rnd), fish = keeperFish(rnd, ctx.counts);
    if (gcd(n, d) > 1 || (w * d) % n) return null;
    const ans = (w * d) / n;
    const wrong = [w * n, Math.round(w / d) || d + w, w * d, w + d, ans + 1].filter((v) => Number.isInteger(v) && v > 0 && v !== ans);
    const opts = shuffle([ans, ...[...new Set(wrong)].slice(0, 3)], rnd).map(String);
    return shape({ topic: 'divide', key: `divide:${w}/${n}/${d}`, fish, answer: String(ans), choices: opts,
      prompt: `You have ${w} pounds of ${KINDS[fish.kind].one} to cut into pieces of ${n}/${d} of a pound for the cook. How many pieces?`,
      why: `Each pound makes ${d} pieces of 1/${d}, so ${w} pounds make ${w * d}${n > 1 ? `; pieces of ${n}/${d} take ${n} of those each: ${w * d} ÷ ${n} = ${ans}` : ''}.`,
      steps: [`${w} ÷ ${n}/${d}: how many ${n}/${d}s fit in ${w}?`, `${w} pounds is ${w * d}/${d}.`, `${w * d} ÷ ${n} = ${ans} pieces.`],
      rule: 'To divide by a fraction, count how many of it fit: turn the whole number into the same bottom number and divide the tops (or multiply by the flipped fraction).' });
  },
};
export const PIE_KINDS = Object.keys(MAKE);

// THE LEVELS' QUESTION: a question at a level's gen (src/levels/place/fishing.js). ctx: { creel, counts }; recent: keys
// of the last questions (steered clear of while another will do). Each carries its gen (for "Teach me" and "Try it").
export function questionAt(gen, rnd = Math.random, ctx = {}, recent = []) {
  ctx = { counts: {}, creel: [], ...ctx };
  if (gen.kind === 'fish') return { ...questionFor(gen.from, gen.topic || (gen.topics ? pick(gen.topics, rnd) : null), rnd, ctx, recent), gen };
  let best = null;
  for (let t = 0; t < 40; t++) {
    const q = MAKE[gen.kind](gen, rnd, ctx);
    if (!q) continue;
    if (!recent.includes(q.key)) return { ...q, gen, from: gen.from || 1 };
    best = best || q;
  }
  if (best) return { ...best, gen, from: gen.from || 1 };
  throw new Error('fishing: no question for ' + gen.kind);
}
// a fresh one of the same kind (the lesson's worked example, or "Try it")
// (topic: the fish question's own topic, for a fish level that mixes two)
export function lessonAt(gen, rnd = Math.random, ctx = {}, topic = null) {
  if (gen.kind === 'fish') return { ...questionOf(topic || gen.topic || (gen.topics ? pick(gen.topics, rnd) : 'keep'), gen.from, rnd, ctx), gen };
  return questionAt(gen, rnd, ctx, []);
}
