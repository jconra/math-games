// THE FISHING RECORDS kept per rider (rider.fishing), and the small pure helpers of the fishing job
// (src/fishingjob.js): no page, no three.js (tests/fishing-records.test.mjs).
//   rider.fishing = { creel: [fish] (the fish kept, in the saddlebags, oldest first; up to CREEL.most), record (the
//     biggest fish, or null), book (the fish book: every kind in three sizes), landed, kept, sold (counts), fresh
//     (a fish kept since the store last bought some) }        fish = { kind, len, lb } (labs/fishing/questions.js)
//   fishingOf(rider)     the records made tidy (made when missing; an old rider has none)
//   keepFish(f, fish)    a fish into the saddlebags; full, the smallest goes back -> a toast [big, small] or null
//   sayable(text)        a line as it is read out: "3/4 ft" -> "3 quarters feet", "1 1/2 lb" -> "1 and 1 half pounds"
//   saleMap(rider, { rand })  which kind of fish sale the store's next customer brings -> { map, most }: see its notes
import { readRecord, readBook, KINDS } from '../labs/fishing/questions.js';
import { value } from '../labs/fishing/frac.js';
import { cleanFish, SALE_FORMS } from './math/fishsale.js';
import { chooseMap, isPlaced, levelOf, readAloud, MAPS } from './math/skill.js';

export const CREEL = { most: 12, sellFirst: true, every: 2 };   // the saddlebags' fish; a customer buys fish the first
                             // time after a catch, then one customer in `every` while there are fish to sell

// the rider's fishing records, made tidy (made when missing): { creel, record, book, landed, kept, sold, fresh }
export function fishingOf(rider) {
  const f = rider.fishing && typeof rider.fishing === 'object' && !Array.isArray(rider.fishing) ? rider.fishing : (rider.fishing = {});
  f.creel = (Array.isArray(f.creel) ? f.creel : []).map(cleanFish).filter(Boolean).slice(-CREEL.most);
  f.record = readRecord(JSON.stringify(f.record || null));
  f.book = readBook(JSON.stringify(f.book || null));
  for (const k of ['landed', 'kept', 'sold']) f[k] = Number.isFinite(+f[k]) && +f[k] > 0 ? Math.floor(+f[k]) : 0;
  f.fresh = !!f.fresh;
  return f;
}
// a fish kept into the saddlebags. Full: the smallest of them all (the new one too) goes back. -> a toast or null
export function keepFish(f, fish) {
  f.creel.push(fish); f.kept++; f.fresh = true;
  if (f.creel.length <= CREEL.most) return null;
  let low = 0; f.creel.forEach((x, i) => { if (value(x.lb) < value(f.creel[low].lb)) low = i; });
  const out = f.creel.splice(low, 1)[0];
  return ['Saddlebags full', out === fish ? 'This one was the smallest: back it goes' : `The smallest, a ${KINDS[out.kind].one}, went back`];
}
// a line said out loud: fractions in words
const DEN = { 2: ['half', 'halves'], 3: ['third', 'thirds'], 4: ['quarter', 'quarters'], 5: ['fifth', 'fifths'], 6: ['sixth', 'sixths'], 8: ['eighth', 'eighths'], 10: ['tenth', 'tenths'], 12: ['twelfth', 'twelfths'] };
export function sayable(text) {
  return String(text || '').replace(/<[^>]+>/g, ' ')
    .replace(/(\d+) (\d+)\/(\d+)/g, (m, w, n, d) => `${w} and ${n} ${DEN[d] ? DEN[d][+n === 1 ? 0 : 1] : 'over ' + d}`)
    .replace(/(\d+)\/(\d+)/g, (m, n, d) => `${n} ${DEN[d] ? DEN[d][+n === 1 ? 0 : 1] : 'over ' + d}`)
    .replace(/\bft\b/g, 'feet').replace(/\bin\./g, 'inches').replace(/\blb\b/g, 'pounds').replace(/\s+/g, ' ').trim();
}

// Which kind of fish sale a customer brings (src/math/fishsale.js SALE_FORMS): by the fish (Word problems), by the
// pound (Fractions) or by a rate (Ratios). A sale by the pound or by a rate comes only once that strand is PLACED: a
// strand still finding its level is found at the dock, where its baseline may be trying a point well above the
// rider's own guess (a 6-year-old right twice on the line-ups is tried at two fish added by the pound), and a counter
// slip is no place for that stretch. So while Fractions is still finding its level the youngest (a rider the
// questions are read to) are paid by the fish, as the store's flour and eggs are sold to them, even before the Word
// problems reach that sale's own step. Anyone else with nothing of those on offer (a rider past the by-the-fish
// sales, Fractions not placed yet) gets the by-the-pound sale held at the strand's own level rather than the point
// being tried (most: stepFor's cap).
//   -> { map, most } (most: null, or the level to hold the sale's question at)
export function saleMap(rider, { rand = Math.random } = {}) {
  const ids = Object.keys(SALE_FORMS);
  const sure = ids.filter((k) => k === 'fishSaleK' || MAPS[k].strands.every((s) => isPlaced(rider, s)));
  const map = chooseMap(rider, sure, { rand }) || (readAloud(rider) ? 'fishSaleK' : chooseMap(rider, ids, { rand })) || 'fishSaleK';
  const open = MAPS[map].strands.filter((s) => !isPlaced(rider, s));
  return { map, most: map !== 'fishSaleK' && open.length ? Math.min(...open.map((s) => levelOf(rider, s))) : null };
}
