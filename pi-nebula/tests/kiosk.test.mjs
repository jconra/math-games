// THE SHIP STORE'S KIOSK (src/kiosk.js; src/own.js STORE, storeOf, saleWords; the game's maker, 2026-11-24: "maybe we
// should have a ship sales screen somewhere, rather then adding that on the end of the captain's card ... a ship store
// kiosk that lets you browse the ships and shows their prices and lets you pick the colors and stuff ... if you go to
// the captain you can still work for them and their ship will be in the hanger in that case"): the kiosk's list and
// prices from the one place they are kept; the sale's words; the one place ships are sold (no captain's card, no
// shipping computer); whose paint a ship wears on its captain's contract; the kiosk in the station.
// No browser: plain numbers, words, and the modules' text.
//   node --test pi-nebula/tests/kiosk.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRICES, SHIP_NAMES, STORE, storeOf, saleOf, saleWords, buy } from '../src/own.js';
import { paintOf, wornOf, captainsNow, setPaint, FACTORY } from '../src/paint.js';
import { missions, sign, signOwn, land, collect, contractOf } from '../src/missions.js';
import { CAPTAINS } from '../src/lines.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const maya = (more = {}) => ({ id: 'p1', name: 'Maya', credits: 500, ...more });
const BRIDGE = { dock: { bridge: { rings: 9, docked: true } } };

test('the kiosk\'s list: the four ships, cheapest first, each with its price from the one list (src/own.js PRICES)', () => {
  assert.deepEqual(STORE, ['explorer', 'medic', 'miner', 'hauler']);
  assert.deepEqual(STORE.map((id) => PRICES[id]), [50000, 55000, 60000, 80000]);
  const L = storeOf(maya({ credits: 61500 }), { bridge: false });
  assert.deepEqual(L.map((S) => [S.ship, S.name, S.price]), STORE.map((id) => [id, SHIP_NAMES[id], PRICES[id]]));
  assert.deepEqual(L.map((S) => S.can), [true, true, true, false], 'the Hauler: not with no bridge');
  assert.deepEqual(storeOf(maya({ credits: 99999 }), { bridge: true }).map((S) => S.can), [true, true, true, true]);
  // (nowhere else is a price written: the kiosk and the cards read PRICES)
  for (const f of ['src/kiosk.js', 'src/contract.js', 'src/mission.js', 'src/jobs/index.js', 'src/jobs/cargolink.js', 'src/lines.js']) assert.doesNotMatch(read(f).split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n'), /50,?000|55,?000|60,?000|80,?000/, f);
});

test('the sale\'s words at the kiosk, as the captains\' cards had them: the price, asked once more, short, not yet for sale, theirs', () => {
  const w = (c, ship, o = {}) => saleWords(saleOf(c, ship, { bridge: o.bridge ?? true }), o);
  assert.deepEqual(w(maya({ credits: 61500 }), 'miner'), { kind: 'can', head: 'Buy the Miner: 60,000 credits', sub: 'You have 61,500 credits.' });
  assert.deepEqual(w(maya({ credits: 61500 }), 'miner', { sure: true }), { kind: 'sure', head: 'Buy the Miner for 60,000 credits?', sub: 'You will have 1,500 credits left.' });
  assert.equal(w(maya({ credits: 60001 }), 'miner', { sure: true }).sub, 'You will have 1 credit left.');
  assert.deepEqual(w(maya({ credits: 59000 }), 'miner'), { kind: 'short', head: 'Buy the Miner: 60,000 credits', sub: 'You have 59,000. You need 1,000 more credits.' });
  assert.deepEqual(w(maya({ credits: 200000 }), 'hauler', { bridge: false }), { kind: 'closed', head: 'The Hauler: 80,000 credits', sub: 'For sale once the bridge out to it is built.' });
  assert.deepEqual(w(maya({ ships: ['explorer'] }), 'explorer'), { kind: 'owned', head: 'The Explorer is yours', sub: 'Take it out any time, from its pilot\'s seat.' });
  // (the buying itself is the one it was: the price spent, the ship kept; a paint picked at the kiosk kept with it)
  const c = maya({ credits: 61500 }); assert.equal(buy(c, 'miner').ok, true); assert.equal(setPaint(c, 'miner', 'olive').ok, true);
  assert.deepEqual([c.credits, c.ships, c.paints], [1500, ['miner'], { miner: 'olive' }]);
});

test('the kiosk is the one place ships are sold: no buy line on a captain\'s card, none on the shipping computer, no captain offers a sale', () => {
  const C = read('src/contract.js'), M = read('src/mission.js'), J = read('src/jobs/index.js'), K = read('src/kiosk.js');
  // (the captain's card: no price, no Buy, no sale card; a ship that is theirs keeps "Take your Miner out")
  assert.doesNotMatch(C, /pmc-buy|Buy the \$\{|For sale \$\{|drawSale|mode === 'sale'|sure/);
  assert.match(C, /The \$\{ship\} is yours/); assert.match(C, /Take your \$\{ship\} out/); assert.match(C, /if \(!S \|\| !S\.owned\) return ''/);
  // (the game: nothing sells but the kiosk; the shipping computer's second button is the owner's Hauler alone)
  assert.doesNotMatch(M, /missions\.sells|saleAbout|K\.sale|buy: \(\) =>/); assert.match(M, /function buyShip\(/);
  assert.equal(missions.sells, undefined); assert.equal(CAPTAINS[Object.keys(CAPTAINS).find((k) => CAPTAINS[k].mission === 'supply')].sale, undefined);
  assert.doesNotMatch(J, /Hauler's sale/);
  // (a captain whose run is not offered has nothing to ask, whatever they could have sold)
  const tully = Object.keys(CAPTAINS).find((k) => CAPTAINS[k].mission === 'supply');
  assert.equal(missions.state(tully, maya({ credits: 999999, jobs: BRIDGE })), 'wait');
  // (the kiosk: its list from STORE, its words from saleWords, the buying through the game's one buyShip, the paints the nine)
  assert.match(K, /STORE\.map/); assert.match(K, /saleWords\(/); assert.match(K, /mission\.buyShip\(/); assert.match(K, /PAINTS\.map/);
  assert.match(read('src/main.js'), /makeKiosk\(\{/);
});

test('whose paint the ship wears: the captain\'s own from signing his contract until its pay is collected; theirs at every other time', () => {
  const c = maya({ ships: ['miner', 'medic'], paints: { miner: 'olive', medic: 'navy' } });
  assert.deepEqual([wornOf(c, 'miner'), wornOf(c, 'medic')], ['olive', 'navy']);
  // (Ruiz's contract signed: the Miner is his; their Medic is still theirs; their paint is kept all the while)
  assert.ok(sign(c, 'mining', ['pilot']));
  assert.equal(captainsNow(c, 'miner'), true); assert.equal(wornOf(c, 'miner'), FACTORY); assert.equal(wornOf(c, 'medic'), 'navy');
  assert.equal(paintOf(c, 'miner'), 'olive'); assert.equal(c.paints.miner, 'olive');
  // (home, the pay waiting: still his; collected: theirs again)
  land(c, { n: 1, store: { iron: 4 } }); assert.equal(contractOf(c).state, 'payout'); assert.equal(wornOf(c, 'miner'), FACTORY);
  collect(c); assert.equal(contractOf(c), null); assert.equal(wornOf(c, 'miner'), 'olive');
  // (a run of their own is theirs: in their paint)
  assert.ok(signOwn(c, 'mining', ['pilot'])); assert.equal(contractOf(c).own, true); assert.equal(wornOf(c, 'miner'), 'olive');
  // (a crew member who does not own it: in its own paint, as ever, contract or not)
  const leo = { id: 'p2', name: 'Leo', credits: 0, paints: { miner: 'olive' } };
  assert.equal(wornOf(leo, 'miner'), FACTORY); sign(leo, 'mining', ['pilot']); assert.equal(wornOf(leo, 'miner'), FACTORY);
  // (old saves: a ship bought before stays bought, with its paint)
  const old = JSON.parse(JSON.stringify({ id: 'p3', name: 'Ada', credits: 10, ships: ['explorer'], bought: { explorer: { at: 1, price: 50000 } }, paints: { explorer: 'teal' } }));
  assert.equal(saleOf(old, 'explorer').owned, true); assert.equal(wornOf(old, 'explorer'), 'teal');
  // (the game lays the paint a ship wears, and shows the paint picked while it is picked: src/shippaint.js)
  const S = read('src/shippaint.js'); assert.match(S, /wornOf\(c, id\)/); assert.match(S, /previews\[id\] \|\|/);
});

test('the kiosk in the station: one, a free-standing piece of the kit, against a wall of a hallway', () => {
  assert.match(read('kit/catalog.js'), /kiosk: \{ name: 'Ship store kiosk', group: 'Furniture', at: 'free'[^\n]*build: kiosk \}/); assert.match(read('kit/furniture.js'), /export function kiosk\(p\)/);
  const R = JSON.parse(read('kit/rooms/station.json'));
  const found = R.rooms.flatMap((r) => (r.pieces || []).filter((p) => p.piece === 'kiosk').map((p) => ({ room: r.id, name: r.name, ...p })));
  assert.equal(found.length, 1, 'one kiosk');
  assert.match(found[0].name, /spine|corridor|hallway/i, found[0].name);
  // (against a wall panel of that room, the panel facing the same way)
  const room = R.rooms.find((r) => r.id === found[0].room);
  assert.ok(room.pieces.some((p) => p.piece === 'wall' && p.cell.join() === found[0].cell.join() && p.turn === found[0].turn), 'against a wall');
  // (the line in the station file that places it is one line)
  assert.equal(read('kit/rooms/station.json').split('\n').filter((l) => /"piece":"kiosk"/.test(l)).length, 1);
});
