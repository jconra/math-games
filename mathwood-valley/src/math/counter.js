// THE COUNTER'S OTHER QUESTIONS: money, time, decimals, percent and ratios at the general store. Most customers bring
// a word problem (src/math/wordproblems.js); now and then one asks something else the store is the right place for:
// "how much change?", "what does your grandfather clock say?", "what's 20% off?", "which is the better buy?". Each
// kind of math is its own strand (src/math/strands.js: money, time, dec, pct, ratio), with its own maker:
//   money   src/math/money.js      coins, prices, change, dollars and cents, the price of one, tax and tips
//   time    src/math/clock.js      the grandfather clock, hours between, am and pm, hours and minutes, timetables
//   dec     src/math/decimals.js   tenths, hundredths, adding, times 10, multiplying, dividing
//   pct     src/math/percent.js    50% 25% 10%, any percent, discounts and tax, up or down, interest
//   ratio   src/math/ratios.js     speed, recipes, ratio tables, shares by a ratio, proportions
// Each maker has STEPS (one per point of its map) and make(t, step, f, { frac }) -> a core:
//   { key, story, ask, right: Face, slips: [Face & { slip, why }] (the likeliest first), wide?, lead? (a picture that
//     is part of the question, shown above the coins from the start: the clock, the coins to count, the timetable),
//     pic (the helper: shown after a wrong pick or on "Draw it for me"; it never shows the answer), rightWhy, credit:
//     [{ strand, at, weight }] (what else the answer counts in, besides the maker's own strand), size, facts, read?,
//     sum? (the question's own sum, for the tools' Work it out, when its working doesn't say it in the question's own
//     numbers: { op, a, b, money?, cash? }, "2.6 × 6" where the working says "6 × 26 tenths"; or its steps in order, each
//     with what it finds: [{ op, a, b, say }], the bill then the change; else the working is read) }
//   Face = { v (the value: two coins never share one, so 0.5 and 0.50 can't both show), big, small, label }
// This file turns a core into an order the store's slip shows (the same shape as wordproblems.js makeOrder's): the
// right coin and up to 3 slips, shuffled. Pure, no page: tests/counter.test.mjs.
//
//   counterOrder(map, { step, frac, rand, who, coins }) -> order (order.counter = the map; order.lead, order.pic: the
//                            pictures for src/ui/counterpics.js counterPicture)
//   counterChoice(rider, { rand, last, share, now }) -> a map to ask, or null (a word problem this time)
//   COUNTER (map -> its maker), COUNTER_MAPS, COUNTER_SHARE, KIND_NAMES
import { tools } from './counterkit.js';
import * as MONEY from './money.js';
import * as TIME from './clock.js';
import * as DEC from './decimals.js';
import * as PCT from './percent.js';
import * as RATIO from './ratios.js';
import { FOLK } from './wordproblems.js';
import { MAPS, STRAND, fits, chooseMap, levelOf, maxOf } from './skill.js';
import { sumOf as checkedSum } from './jobsums.js';

export const COUNTER = { money: MONEY, time: TIME, dec: DEC, pct: PCT, ratio: RATIO };
export const COUNTER_MAPS = Object.keys(COUNTER);
// about this share of the customers bring one of these (when any fits the rider); the rest bring word problems, the
// store's own job
export const COUNTER_SHARE = 0.4;
export const KIND_NAMES = { money: 'Money', time: 'Telling time', dec: 'Decimals', pct: 'Percent', ratio: 'Ratios and rates' };
// a coin's label longer than this (or a maker's wide: true): word coins, two to a row
const WIDE_PAST = 7;

const keyOf = (v) => (typeof v === 'number' ? `n${Math.round(v * 1e6)}` : `s${v}`);

export function counterOrder(map, { step = 1, frac = 0, rand = Math.random, who = null, coins = 4 } = {}) {
  const M = COUNTER[map];
  if (!M) throw new Error('counterOrder: no maker for ' + map);
  const t = tools(rand);
  const st = Math.max(1, Math.min(M.STEPS.length, Math.round(Number(step)) || 1));
  for (let tries = 0; tries < 30; tries++) {
    const f = who || t.pick(FOLK);
    const core = M.make(t, st, f, { frac: Math.max(0, Math.min(1, Number(frac) || 0)) });
    if (!core || !core.right) continue;
    const seen = new Set([keyOf(core.right.v)]), labels = new Set([core.right.label]);
    const wrong = [];
    for (const s of core.slips || []) {
      if (!s || wrong.length >= coins - 1) continue;
      if (s.v == null || seen.has(keyOf(s.v)) || labels.has(s.label) || !s.big) continue;
      if (typeof s.v === 'number' && s.v < 0) continue;   // (a coin that says less than nothing, "−5¢" change: no one would believe it)
      if (/NaN|undefined|Infinity/.test(`${s.big} ${s.label}`)) continue;
      seen.add(keyOf(s.v)); labels.add(s.label);
      wrong.push({ v: s.v, big: s.big, small: s.small || '', label: s.label, good: false, slip: s.slip || null, why: s.why || '' });
    }
    if (wrong.length < 2) continue;
    const R = core.right;
    const all = t.shuffle([{ v: R.v, big: R.big, small: R.small || '', label: R.label, good: true, slip: null, why: '' }, ...wrong]);
    const wide = !!core.wide || all.some((c) => String(c.big).length > WIDE_PAST);
    const m = MAPS[map];
    return {
      id: Math.floor(rand() * 1e9).toString(36), type: map, counter: map, strand: m ? m.strand : map, step: st, frac, ladder: 'counter',
      key: core.key, who: f, story: core.story, ask: core.ask, read: core.read || `${core.story} ${core.ask}`,
      coins: all, answer: R.label, unit: null, cents: false, pic: core.pic || null, lead: core.lead || null, picFirst: false,
      wide, rightWhy: core.rightWhy, afterWhy: '', equation: null,
      credit: (core.credit || []).filter((c) => c && STRAND[c.strand] && Number.isFinite(c.at)).map((c) => ({ strand: c.strand, at: c.at, weight: c.weight ?? 0.5 })),
      size: core.size || 1, long: null, facts: core.facts || null, sum: sumOf(core.sum),
    };
  }
  throw new Error(`no ${map} question could be made at step ${st}`);
}

// a maker's own sum (or steps) for Work it out, checked (src/math/jobsums.js sumOf): { op, a, b } (decimals welcome,
// never below 0), money and cash kept; steps: { chain }
const sumOf = (s) => checkedSum(s);

// Which question the next customer brings: one of these (a map that fits the rider's level, chosen the skill model's
// way: a strand still finding its level more often, one not practised lately more often, not the one just asked), or
// null for a word problem. share: how often one of these comes up when any fits. A strand at the top of what its
// maker has (a teen and the clock) comes up only now and then (MASTERED_KEEP of the times it would), as a review.
export const MASTERED_KEEP = 0.25;
export function counterChoice(rider, { rand = Math.random, last = null, share = COUNTER_SHARE, now = Date.now() } = {}) {
  const top = (k) => levelOf(rider, MAPS[k].strand) >= maxOf(MAPS[k].strand) - 1;
  const ok = COUNTER_MAPS.filter((k) => MAPS[k] && fits(rider, k, [k], now) && (!top(k) || rand() < MASTERED_KEEP));
  if (!ok.length || rand() >= share) return null;
  return chooseMap(rider, ok, { rand, last, now });
}
