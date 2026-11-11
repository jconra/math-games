// SELLING YOUR GOODS TO EZRA: at the bins by the general store's counter (the store recipe's spot 'sell': src/townrooms.js),
// E "Sell my goods" opens a deal with the clerk, Ezra Platt, between the two of you: you are the farmer supplying the store.
// The game's maker: "So you are the farmer supplying the store. Only 'working the counter' should be selling to customers."
// Each sale is a question about what you carry, on the same order slip as the counter's (src/ui/storeslip.js): eggs, milk
// and flour by the dozen, the gallon or the sack (src/math/goods.js makeSale), wool by the fraction, and the fish kept at
// the dock (src/math/fishsale.js). A right coin sells them: you get the gold the answer comes to, and on top of it what the
// counter would have tipped for the same work (the goods are yours: it always pays more than wages). The deals go on while
// there is something he can buy, or until "Done for now" (or Esc). They count in their own kinds of math, never move the
// store's level, and are no part of the counter's shift (nor do they count as orders filled).
//
//   const G = makeGoodsDeal({ rider, P, I, hud, hob, refresh, goods, fish, say, voice, work, pay, onStart, onStop })
//     goods: the homestead (src/homestead.js: goods.sale(plan, who), goods.sold(order)); fish(): the fishing job, or null;
//     say(text): Ezra says it, in his speech card; voice(): his recorded greeting; work(): the tools' Work it out
//   G.words()      the spot's prompt   G.start()   E at the bins   G.stop()   done for now
//   G.active, G.workSum() (the tools' Work it out), G.skip() (the help menu's skip: a different deal), G.state(),
//   G.dev.next(order) (a rig's next sale), G.dispose()
import { makeStoreSlip, speakLine } from '../ui/storeslip.js';
import { picture } from '../ui/storepics.js';
import { sumOf, workFrom } from '../math/jobsums.js';
import { homestead, GOODS_IDS } from '../math/goods.js';
import { MAPS } from '../math/strands.js';
import { readAloud } from '../math/skill.js';
import { levelFor } from '../levels/model.js';
import { answerTimer } from '../ui/answertimer.js';
import { earn, recordAnswer, saveRider } from '../save.js';

export const EZRA = { name: 'Ezra Platt', she: false };
export const SELL_WORDS = {
  hello: "What've you brought me? I pay fair for good farm goods.",
  thanks: 'Much obliged. Bring me more any time.',
  nothing: 'Nothing to sell yet, partner. Eggs, wool and milk wait behind your cabin once you keep animals, and I buy the fish you catch off the dock.',
  small: "That's not enough to make a sale yet. Bring me two dozen eggs, two gallons of milk, or a bit more wool.",
};
const formsOf = (map) => (MAPS[map] ? MAPS[map].ids.map((id, i) => [id, MAPS[map].anchors[i]]) : []);
// the form of sale that fits the store's level: the hardest at or under its school year. These deals are the only way to
// sell goods, so a rider under the easiest form still gets it (at: null, not counted on its strand).
export function formAt(map, grade) {
  const list = formsOf(map); let id = null, at = null;
  for (const [k, p] of list) if (p <= grade) { id = k; at = p; }
  return id ? { id, at } : list.length ? { id: list[0][0], at: null } : null;
}
// the plan makeSale takes, for what the rider carries (src/math/goods.js)
export function salePlan(carried, { step = 1, grade = 0 } = {}) {
  const plan = { step, sales: null, wool: null };
  const sf = carried.eggs || carried.milk || carried.flour ? formAt('sales', grade) : null, wf = carried.wool ? formAt('wool', grade) : null;
  if (sf) Object.assign(plan, { sales: sf.id, salesAt: sf.at });
  if (wf) Object.assign(plan, { wool: wf.id, woolAt: wf.at });
  return plan;
}
// the extra on top of the sale's own gold: what the counter tips for a question at this level
export const wageOf = (pay, q) => pay.order + Math.floor((1 + Math.round(8 * q.i / Math.max(1, q.n - 1)) - 1) / pay.orderEvery);

export function makeGoodsDeal({ rider, P, I, hud, hob = null, refresh = () => {}, goods = null, fish = () => null, say = () => {}, voice = () => {}, work = null, pay = { order: 3, orderEvery: 3 }, onStart = () => {}, onStop = () => {} }) {
  const U = makeStoreSlip(document.body, { onPick: (i) => pick(i), onDone: () => G.stop(), onDraw: () => draw(), onWork: () => { if (work) work(); } });
  const G = { active: false };
  let order = null, missed = false, sold = 0, earned = 0, timer = null, forced = null, seq = 0;
  const carrying = () => { const g = homestead(rider).goods, F = fish && fish(); return GOODS_IDS.some((k) => g[k] > 0) || !!(F && F.creel && F.creel().length); };
  G.words = () => 'Sell my goods';

  function deal() {
    if (forced) { const o = forced; forced = null; return o; }
    const q = levelFor(rider, 'store'), carried = homestead(rider).goods, grade = q.level.grade, F = fish && fish();
    // (fish and the farm's goods in turn, when there are both)
    const tries = [() => (F && F.saleOrder ? F.saleOrder({ who: EZRA, grade, force: true }) : null), () => (goods ? goods.sale(salePlan(carried, { step: 1 + Math.round(8 * q.i / Math.max(1, q.n - 1)), grade }), EZRA) : null)];
    if (seq++ % 2) tries.reverse();
    let o = null; for (const t of tries) if ((o = t())) break;
    if (o) { o.wage = wageOf(pay, q); o.placing = false; }
    return o;
  }
  function next() {
    order = deal(); missed = false;
    if (!order) return false;
    order.work = true;
    U.purse(rider.gold);
    const young = readAloud(rider);
    U.show(order, { filled: sold, pic: null, read: young, lead: null, note: '' });
    if (young && order.read) setTimeout(() => { if (order && order.read && G.active && !U.busy) speakLine(order.read); }, 500);
    if (timer) timer.cancel();
    timer = answerTimer();
    return true;
  }
  function answered(o, right) {
    if (o.recorded) return; o.recorded = true;
    const t = timer ? timer.stop() : {}, s = o.sale;
    const strands = [s.at != null ? { strand: s.strand || (s.map === 'wool' ? 'frac' : 'words'), at: s.at } : null, ...(o.credit || []).map((c) => ({ strand: c.strand, at: c.at, weight: c.weight }))].filter((x) => x && x.at != null);
    const rec = recordAnswer(rider, right, { strands, sitDown: true, size: o.size || 1, ms: t.ms, hidden: t.hidden, idle: t.idle });
    if (rec && rec.badge) hud.toast(`You earned the ${rec.badge} badge!`, 'gold');
  }
  async function pick(i) {
    if (!order || U.busy) return;
    const o = order, c = o.coins[i]; if (!c) return;
    if (!o.picked) answered(o, c.good);
    o.picked = true;
    if (!c.good) { missed = true; U.wrong(i, { why: c.why, pic: (o.picture || picture)(o.pic) }); saveRider(rider); return; }
    const s = o.sale, F = fish && fish(), wage = o.wage || 0, gold = s.gold + wage, from = rider.gold;
    if (s.goods === 'fish') { if (F) F.sold(o); } else if (goods) goods.sold(o);
    const e = earn(rider, gold); sold++; earned += gold;
    if (e && e.newTitle) hud.toast(`You're a ${e.newTitle} now!`, 'gold');
    setTimeout(refresh, 700);
    order = null;
    await U.right(o.coins.findIndex((k) => k.good), { line: o.rightWhy, gold, from, to: rider.gold, note: missed ? '' : 'right first time', news: [], paid: `+${s.gold} gold for your ${s.goods}, +${wage} from Ezra for hauling it in` });
    if (!G.active) return;
    await U.leave();
    if (!G.active) return;
    if (!next()) { say(carrying() ? SELL_WORDS.small : SELL_WORDS.thanks); G.stop(); }
  }
  function draw() { if (order && !U.busy) U.drawn((order.picture || picture)(order.pic)); }
  // the help menu's "Skip to a new question" (src/ui/helpmenu.js): Ezra offers a different deal for what you carry (the
  // goods stay yours, unsold). Sales never move the store's level, so neither does skipping one (main.js). False while
  // the coins are flying, or when he has no other deal to offer.
  G.skip = () => {
    if (!G.active || !order || U.busy) return false;
    const was = order;
    if (next()) return true;
    order = was;
    return false;
  };

  G.start = () => {
    if (G.active) return false;
    if (!carrying()) { say(SELL_WORDS.nothing); return false; }
    G.active = true; sold = 0; earned = 0; order = null;
    if (!next()) { G.active = false; say(SELL_WORDS.small); return false; }
    P.enabled = false; onStart();
    say(SELL_WORDS.hello); voice();
    return true;
  };
  G.stop = () => {
    if (!G.active) return;
    G.active = false; order = null;
    if (timer) { timer.cancel(); timer = null; }
    try { if (globalThis.speechSynthesis) speechSynthesis.cancel(); } catch (e) { /* (no voice) */ }
    U.hide();
    P.enabled = true; onStop();
    if (sold) { hud.toast(`Sold to Ezra: ${sold} deal${sold === 1 ? '' : 's'} · +${earned} gold`, 'gold'); if (hob) hob.event('goodsSold'); }
    saveRider(rider); refresh();
  };
  const onKey = (e) => {
    if (e.key !== 'Escape' || !G.active || e.defaultPrevented || e.repeat) return;
    if (document.querySelector('.bms, .lbx, .bml:not(.is-out), .tch:not(.out), .bmtl-menu')) return;
    e.preventDefault(); G.stop();
  };
  addEventListener('keydown', onKey, true);
  // the sum on the slip, for the tools' Work it out: plain help, the kid still picks the coin
  G.workSum = () => {
    if (!G.active || !order || U.busy) return null;
    const s = order.sum ? sumOf(order.sum) : workFrom(order.rightWhy || '');
    return s ? { ...s, ask: order.ask, story: true } : null;
  };
  G.state = () => ({ active: G.active, sold, earned, order: order ? { story: order.story, ask: order.ask, who: order.who && order.who.name, coins: order.coins.map((c) => ({ label: c.label, good: !!c.good })), sale: order.sale, wage: order.wage } : null, busy: U.busy });
  G.dev = { next: (o) => { forced = o; } };
  G.dispose = () => { removeEventListener('keydown', onKey, true); if (G.active) G.stop(); U.dispose(); };
  return G;
}
