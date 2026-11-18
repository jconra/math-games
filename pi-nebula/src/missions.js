// THE MISSIONS: crewing a captain's ship on a trip out (mining first; exploring and rescue to come). This file is the
// plain part of it, with no page and no three.js, so node can test it (pi-nebula/tests/missions.test.mjs): the
// contract and its roles, the trip's steps, what a haul the crew flew is worth and each share of it, what is kept with
// the crew member, and the payout card. In the game: src/mission.js joins it to the station (the captain, the pilot's
// seat, the smelter's controls), src/contract.js is the contract's card, and src/trip.js is the trip itself, loaded
// only when one starts.
//
// THE GAME'S MAKER (2026-11-17): "when someone is talking with a mining captain about going on a mission, the captain
// should offer you a contract. It might say '10% for piloting to location / 20% for operating the drill / 20% for
// serving as engineer' so then if the ore is worth 10000, and the contract said they get 50% of it, then they would
// make 5,000 credits. But that would involve all the work from that mission. Since the mission would probably take 10
// minutes, they should make about 1/6 of what a 50,000 ship costs, so about 8,300 credits. If they are doing a contract
// and they are only selecting to be a pilot, then it should drastically cut down the amount of time the mission takes
// (to just 2 minutes). So the whole 'drilling asteroids' and 'engineering problems' can be skipped. Maybe there can
// just be a short cut-scene of the ship doing the work and then it will be giving you a problem to calculate the jump
// to get back to the station. Then you only get 10% from the contract."
//
// A MISSION IS DATA (MISSIONS): its captain and ship, its roles and their shares, one plain line on how it pays, and
// its steps in order. Each KIND of step has one runner in src/trip.js ('leave', 'jump', 'work', 'land'); a step names
// the role that does it, and a role whose game is not made yet (ROLES: `ready`) is done by the captain's own crew. So
// another captain's trip is another entry here with its own steps, and a new role's game switches on with its flag.
//
// THE MONEY (the game's maker, 2026-11-18: "It's as simple as add up what they came back with and multiply each type
// of metal with what it is worth and that's what you get paid"). What comes home is a STORE: so many tonnes of each
// metal (src/drill.js: the crew member's own drilling, or the captain's own driller working the same field by the
// same rules). It sells for each metal's tonnes times what a tonne of it sells for, added up (src/jobs/smelter.js
// sellsFor, the one price list). The crew member's pay is their roles' shares of that, added up: the pilot's 10% of
// an 18,000 credit haul is 1,800 credits. NOTHING ELSE ENTERS IT: no answer to any card changes what comes home or
// what it sells for. The jump's three lamps only show where the pilot is in the jump (green for a card right at the
// first pick, amber after a miss). The cards on a run are not paid one by one: the share is the pay for all the work
// of the run.
//
// KEPT WITH THE CREW MEMBER (save.js keeps any field): crew.mission, one at a time:
//   { id, captain, roles: [...], state: 'signed', signed }                the contract signed, the run not flown yet
//   { ..., state: 'payout', payout: { n, canisters, tonnes, lots: [{ metal, tonnes, price, pay }] (the plain sum,
//     metal by metal, the most tonnes first), sold, share, pay, at } }   home: the share waiting at the smelter's controls
// A reload in the middle of a trip finds the contract still signed. Collected, the mission is cleared and the captain
// asks again.
//
//   import { missions } from './missions.js'
//   missions.state(id, crew)         a captain's offer, for this crew member: 'new' (not asked yet) | 'asked' |
//                                    'interested' | 'declined' (this visit only), or from their contract: 'signed' |
//                                    'payout'
//   missions.answer(captain, yes)    the player's answer to a captain's offer (captain: { id, name, ship, mission })
//   missions.go(captain, yes)        ... to "shall we go now?", once signed
//   missions.on(fn) / onGo(fn)       fn(captain, yes) after each (src/mission.js opens the contract, starts the trip)
//   missions.ready(id)               whether that captain's mission can be flown (its data is here)
import { ownOrder, earn, jobTally } from './jobs/engine.js';
import { haulOf, flownHaul, sellsFor, lotsWords, tonnesWords } from './jobs/smelter.js';

// ── the roles: what each does, its share of what the haul sells for (percent), whether its game is made yet (one flag:
// until then the captain's own crew member does it), and who that is ──
export const ROLES = {
  pilot: { id: 'pilot', name: 'Pilot', does: 'piloting to the rocks and home', share: 10, ready: true, crew: 'Pilot Juno' },
  drill: { id: 'drill', name: 'Drill operator', does: 'operating the drill', share: 20, ready: true, crew: 'Miner Kestrel' },
  engineer: { id: 'engineer', name: 'Engineer', does: 'serving as engineer', share: 20, ready: false, crew: 'Engineer Okafor' },
};
export const CARDS = 3;      // the cards of a jump (its three lamps: distance, charge, go)
export const LAMPS = ['Distance', 'Charge', 'Go'];

// ── the missions ──
// steps: { id, kind, role (who does it), ... }; kinds: 'leave' (out of the hangar on autopilot), 'jump' (the jump
// computer: `cards` cards, then the jump `to` the field or home),
// 'work' (at the field: the roles that work there, and how long the crew takes when the player has none of them),
// 'land' (home on autopilot, the haul aboard)
export const MISSIONS = {
  mining: {
    id: 'mining', captain: 'ruiz', ship: 'miner', name: 'Mining run', roles: ['pilot', 'drill', 'engineer'],
    paid: 'You are paid your share of what the haul sells for, at the smelter\'s controls, when you are back.',
    steps: [
      { id: 'out', kind: 'leave', secs: 4 },
      { id: 'jumpOut', kind: 'jump', role: 'pilot', cards: CARDS, to: 'field' },
      { id: 'field', kind: 'work', roles: ['drill', 'engineer'], secs: 18 },
      { id: 'jumpHome', kind: 'jump', role: 'pilot', cards: CARDS, to: 'home' },
      { id: 'home', kind: 'land', secs: 5 },
    ],
  },
  // (the other captains' trips go here, each its own data: exploring for Captain Vega, rescue for Captain Hale)
};
export const missionOf = (captainId) => Object.values(MISSIONS).find((M) => M.captain === captainId) || null;

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const say = (n) => Number(n).toLocaleString('en-US');

// ── the contract ──
// the roles of a mission as the contract shows them: [{ ...role, open }], open: the player can sign for it
export const rolesOf = (M) => M.roles.map((id) => ({ ...ROLES[id], open: !!ROLES[id].ready }));
// the roles a crew member may sign for, of those asked (in the mission's own order); none asked: every open one
export function openRoles(M, asked = null) {
  const open = M.roles.filter((id) => ROLES[id].ready);
  return asked ? open.filter((id) => asked.includes(id)) : open;
}
// the share of a set of roles, in percent of what the haul sells for; and the pay it comes to, in whole credits
export const shareOf = (roleIds) => roleIds.reduce((s, id) => s + (ROLES[id] ? ROLES[id].share : 0), 0);
export const payOf = (sold, percent) => Math.round(sold * percent / 100);
// "Pilot", "Pilot and drill operator", "Pilot, drill operator and engineer"
export function rolesWords(roleIds) {
  const names = roleIds.map((id, i) => (i ? ROLES[id].name.toLowerCase() : ROLES[id].name));
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
// who does each role on a trip: the crew member (their name) for the roles they signed for, the captain's own crew for
// the rest
export const crewFor = (M, mine, name = 'You') => M.roles.map((id) => ({ role: id, name: mine.includes(id) ? name : ROLES[id].crew, you: mine.includes(id) }));

// the trip's steps for a crew member with these roles: each step, and whether it is theirs to do (`mine`: their role,
// its game made) or the crew's
export function stepsFor(M, mine) {
  return M.steps.map((s) => {
    const roles = s.role ? [s.role] : s.roles || [];
    return { ...s, mine: roles.some((id) => mine.includes(id) && ROLES[id].ready) };
  });
}

// ── what a run brings home ──
// what a store would sell for, and the pay of a share of it (the plain sum; the tests, the notes, the contract's card)
export function forecast({ store = {}, roles = ['pilot'] } = {}) {
  const S = sellsFor(store), share = shareOf(roles);
  return { tonnes: S.tonnes, lots: S.lots, sold: S.pay, share, pay: payOf(S.pay, share) };
}

// ── kept with the crew member ──
// their mission as kept (tidied: a mission and roles this build knows), or null
export function contractOf(crew) {
  const m = crew && crew.mission;
  if (!isObj(m) || !MISSIONS[m.id]) return null;
  const M = MISSIONS[m.id], roles = Array.isArray(m.roles) ? M.roles.filter((id) => m.roles.includes(id)) : [];
  if (!roles.length) return null;
  if (m.state === 'payout' && isObj(m.payout) && Number.isFinite(+m.payout.pay) && +m.payout.pay >= 0) return m;
  return m.state === 'signed' ? m : null;
}
// the contract signed for these roles (only roles whose game is made) -> the mission as kept, or null (none of them
// can be signed for, or another mission is still on)
export function sign(crew, missionId, roleIds, now = Date.now()) {
  const M = MISSIONS[missionId];
  if (!M || !crew || contractOf(crew)) return null;
  const roles = openRoles(M, roleIds);
  if (!roles.length) return null;
  crew.mission = { id: M.id, captain: M.captain, roles, state: 'signed', signed: now };
  return crew.mission;
}
// home from the run: the haul's facts set for every slip about it (flownHaul: its store), and the crew member's share
// of what it sells for waiting at the smelter's controls. n: the haul's number (src/crane.js arrive); store: the
// tonnes of each metal that came home. -> the payout, or null (no contract signed)
export function land(crew, { n = 0, store = {}, now = Date.now() } = {}) {
  const m = contractOf(crew);
  if (!m || m.state !== 'signed') return null;
  flownHaul(n, { store });
  const H = haulOf(n), share = shareOf(m.roles);
  m.state = 'payout';
  m.payout = { n: H.n, canisters: H.canisters, tonnes: H.tonnes, lots: H.lots.map((L) => ({ metal: L.metal.name, tonnes: L.tonnes, price: L.price, pay: L.pay })), sold: H.pay, share, pay: payOf(H.pay, share), at: now };
  return m.payout;
}
// the share collected: the credits arrive as a job's pay does (the crew member's credits, a tally of its own), and the
// mission is done. -> { pay, credits } or null (nothing waiting)
export function collect(crew) {
  const m = contractOf(crew);
  if (!m || m.state !== 'payout') return null;
  const pay = Math.max(0, Math.floor(+m.payout.pay || 0));
  const credits = earn(crew, m.id, pay);
  jobTally(crew, m.id).n++;      // (the runs flown and paid)
  delete crew.mission;
  return { pay, credits };
}
// (the contract given up before the run: the rigs and the tests)
export function tearUp(crew) { if (crew) delete crew.mission; }

// ── THE PAYOUT CARD, at the smelter's controls. It shows the plain sum, as a slip: each metal that came home, its
// tonnes, what a tonne of it sells for and what that comes to; what the haul sold for; the crew member's share. Under
// it the crew member works out (or, for the youngest, counts) something of this haul that suits their own level
// there, and the pay arrives with the right answer. A miss never loses the pay.
//   grade   the school-guide point of the smelter level they are on (0 starting kindergarten .. 80 eighth grade):
//           under 20   COUNT: the canisters the crew brought home (the youngest: the four on one side of the Miner)
//           20 to 43   ADD: what each metal sold for, added up: what the haul sold for (one metal only: its tonnes
//                      times what a tonne sold for)
//           44 to 57   A PART: their share as tenths of what it sold for (1/10 of 18,000)
//           58 on      PERCENT: their share's percent of what it sold for (10% of 18,000)
//   m: the crew member's mission as kept, its payout waiting (contractOf)
//   -> an order in the job panel's own shape (engine.js ownOrder), with `payout` (the pay it brings) and `form`
const CREDIT = ['credit', 'credits'], CAN = ['canister', 'canisters'];
const N = (n, unit) => ({ v: n, big: say(n), small: n === 1 ? unit[0] : unit[1], label: `${say(n)} ${n === 1 ? unit[0] : unit[1]}` });
const cap = (s) => s[0].toUpperCase() + s.slice(1);
export const payoutForm = (grade) => (grade < 20 ? 'count' : grade < 44 ? 'add' : grade < 58 ? 'part' : 'percent');
// a payout's lots (one kept before the store was one: its one metal's ore, sold by the tonne)
const lotsOf = (P) => (Array.isArray(P.lots) && P.lots.length ? P.lots : [{ metal: P.metal || 'iron', tonnes: P.oreTonnes || 6, price: Math.round((P.sold || 0) / (P.oreTonnes || 6)), pay: P.sold || 0 }]);
// the slip's rows: the plain sum. ask: which row is the one asked for ('sold' or 'pay': shown as "?"), or none
export function payoutLines(P, ask = null) {
  const lots = lotsOf(P);
  return [...lots.map((L) => [cap(L.metal), `${tonnesWords(L.tonnes)} × ${say(L.price)} = ${say(L.pay)}`]),
    ['The haul sold for', ask === 'sold' ? '?' : `${say(P.sold)} credits`], ['Your share', `${P.share}%`], ['Your pay', ask ? '?' : `${say(P.pay)} credits`]];
}
export function payoutOrder(m, grade = 0, rand = Math.random) {
  const P = m.payout, form = payoutForm(grade), who = rolesWords(m.roles), tenths = P.share / 10, lots = lotsOf(P);
  const top = { from: 'Your share' };
  const done = (o) => Object.assign(o, { payout: P.pay, form });
  // (what the right answer's line says: the pay, in every form)
  const paid = `Your share, ${P.share}%, is ${say(P.pay)} credits.`;
  const home = `Your crew is home with ${lotsWords(lots)}`;
  if (form === 'count') {
    // (the youngest: one side of the Miner, four canisters; a little older: all eight)
    const side = grade < 6, n = side ? P.canisters / 2 : P.canisters;
    return done(ownOrder({
      key: `payout:count:${side ? 'side' : 'all'}`,
      story: `${home}. It sold for ${say(P.sold)} credits. Your share is ${say(P.pay)} credits.`,
      ask: side ? 'How many canisters are on this side of the Miner?' : 'How many canisters did your crew bring home?',
      right: N(n, CAN),
      slips: [
        { ...N(n + 1, CAN), slip: 'off', why: 'One too many. Count again, touching each one once.' },
        { ...N(n - 1, CAN), slip: 'off', why: 'One short. Count again, touching each one once.' },
        { ...N(n + 2, CAN), slip: 'off', why: 'Too many. Count again, touching each one once.' },
      ],
      rightWhy: `${say(n)} canisters. ${paid}`,
      lines: payoutLines(P),
      picFirst: true, help: { title: 'Count them', pic: { kind: 'cans', place: side ? 'row' : 'ship', slots: Array(n).fill('full') }, line: 'Touch each canister once as you count: 1, 2, 3 ...' },
      own: { strand: 'number', at: side ? 0 : 6 }, facts: { ...top, form, n, pay: P.pay },
    }, rand, 3));
  }
  if (form === 'add' && lots.length > 1) {
    // (what each metal sold for, added up)
    const pays = lots.map((L) => L.pay), step = Math.max(...lots.map((L) => L.price));
    const chain = pays.slice(1).map((p, i) => ({ op: 'add', a: pays.slice(0, i + 1).reduce((x, y) => x + y, 0), b: p, say: i ? 'Then the next' : 'First two of them' }));
    return done(ownOrder({
      key: 'payout:add',
      story: `${home}.`,
      ask: 'How many credits did the haul sell for?',
      right: N(P.sold, CREDIT),
      slips: [
        { ...N(pays[0], CREDIT), slip: 'part', why: `That is only the ${lots[0].metal}. Add what the ${lots.length === 2 ? lots[1].metal : 'others'} sold for.` },
        { ...N(P.sold - pays[pays.length - 1], CREDIT), slip: 'part', why: `That leaves out the ${lots[lots.length - 1].metal}. Add every metal.` },
        { ...N(P.sold + step, CREDIT), slip: 'off', why: 'That is too much. Add them again, the thousands first.' },
        { ...N(P.sold + 1000, CREDIT), slip: 'off', why: 'A thousand too many. Add them again, the thousands first.' },
        ...(P.sold > 1000 ? [{ ...N(P.sold - 1000, CREDIT), slip: 'off', why: 'A thousand short. Add them again, the thousands first.' }] : []),
      ],
      rightWhy: `${pays.map(say).join(' + ')} = ${say(P.sold)} credits. ${paid}`, sum: chain.length === 1 ? chain[0] : chain,
      lines: payoutLines(P, 'sold'),
      help: { title: 'Metal by metal', line: 'The haul sold for what each of its metals sold for, added up.', steps: [pays.map(say).join(' + ')] },
      own: { strand: 'add', at: 30 }, facts: { ...top, form, sold: P.sold, pay: P.pay }, size: Math.min(3, lots.length - 1),
    }, rand));
  }
  if (form === 'add') {
    // (one metal: its tonnes times what a tonne of it sold for)
    const L = lots[0], t = L.tonnes, per = L.price, whole = Number.isInteger(t);
    return done(ownOrder({
      key: 'payout:times',
      story: `${home}. Each tonne of ${L.metal} sold for ${say(per)} credits.`,
      ask: 'How many credits did the haul sell for?',
      right: N(P.sold, CREDIT),
      slips: [
        { ...N(per, CREDIT), slip: 'one', why: `${say(per)} credits is what one tonne sold for. There are ${tonnesWords(t)}.` },
        { ...N(per + Math.round(t), CREDIT), slip: 'added', why: `That adds the tonnes to the price. Every tonne sold for ${say(per)} credits: multiply.` },
        { ...N(P.sold + per, CREDIT), slip: 'groupOff', why: `That is a tonne too many. There are ${tonnesWords(t)}.` },
        ...(P.sold - per > 0 ? [{ ...N(P.sold - per, CREDIT), slip: 'groupOff', why: `That is a tonne short. There are ${tonnesWords(t)}.` }] : []),
      ],
      rightWhy: `${say(t)} × ${say(per)} = ${say(P.sold)} credits. ${paid}`, sum: { op: 'mul', a: t, b: per },
      lines: payoutLines(P, 'sold'),
      help: { title: 'Tonne by tonne', ...(whole && t <= 8 ? { pic: { kind: 'tonnes', n: t, price: per } } : {}), line: `Every tonne of ${L.metal} sold for ${say(per)} credits: ${say(t)} lots of ${say(per)}.`, steps: [`${say(t)} lots of ${say(per)}: ${say(t)} × ${say(per)}`] },
      own: { strand: 'words', at: 26 }, facts: { ...top, form, t, per, pay: P.pay },
    }, rand));
  }
  const one = P.sold / 10;   // (a tenth of what it sold for: every share is so many tenths)
  if (form === 'part') {
    const half = tenths === 5, frac = half ? '1/2' : `${tenths}/10`;
    return done(ownOrder({
      key: 'payout:part',
      story: `The haul sold for ${say(P.sold)} credits. Your share is ${frac} of it.`,
      ask: 'How many credits is your share?',
      right: N(P.pay, CREDIT),
      slips: [
        { ...N(P.sold - P.pay, CREDIT), slip: 'rest', why: `That is the rest of it, the crew's and the captain's. Your share is ${frac} of the ${say(P.sold)} credits.` },
        ...(tenths > 1 && !half ? [{ ...N(one, CREDIT), slip: 'onePart', why: `${say(one)} credits is one tenth. Your share is ${tenths} tenths.` }] : []),
        { ...N(P.sold / 100, CREDIT), slip: 'tooSmall', why: `That cuts the ${say(P.sold)} credits into 100 parts. ${half ? 'A half is 2 equal parts.' : 'Tenths are 10 equal parts.'}` },
        { ...N(half ? P.sold / 4 : P.pay + one, CREDIT), slip: 'partOff', why: half ? 'That is a quarter. A half is one of 2 equal parts.' : `That is ${tenths + 1} tenths. Your share is ${tenths}.` },
        { ...N(P.sold - 10, CREDIT), slip: 'subtracted', why: `That takes 10 away. Cut the ${say(P.sold)} credits into ${half ? 2 : 10} equal parts instead.` },
        { ...N(P.pay + 1000, CREDIT), slip: 'off', why: 'A thousand too many. Work it out again.' },
      ].filter((s) => Number.isInteger(s.v)),
      rightWhy: half ? `${say(P.sold)} ÷ 2 = ${say(P.pay)} credits` : tenths === 1 ? `${say(P.sold)} ÷ 10 = ${say(P.pay)} credits` : `One tenth is ${say(P.sold)} ÷ 10 = ${say(one)}; ${tenths} tenths are ${tenths} × ${say(one)} = ${say(P.pay)} credits`,
      sum: half ? { op: 'div', a: P.sold, b: 2 } : tenths === 1 ? { op: 'div', a: P.sold, b: 10 } : [{ op: 'div', a: P.sold, b: 10, say: 'First one tenth of it' }, { op: 'mul', a: one, b: tenths, say: `Then ${tenths} tenths` }],
      lines: [...payoutLines(P, 'pay').slice(0, -2), ['Your share', `${frac} of it`], ['Your pay', '?']],
      help: { title: 'Cut into equal parts', pic: { kind: 'sharebar', whole: P.sold, n: half ? 1 : tenths, d: half ? 2 : 10 },
        line: half ? `A half means the ${say(P.sold)} credits cut into 2 equal parts, and one of them yours.` : `${frac} means the ${say(P.sold)} credits cut into 10 equal parts, and ${tenths === 1 ? 'one of them' : `${tenths} of them`} yours.`,
        steps: half ? [`One of the 2 equal parts: ${say(P.sold)} ÷ 2`] : tenths === 1 ? [`One of the 10 equal parts: ${say(P.sold)} ÷ 10`] : [`First one tenth: ${say(P.sold)} ÷ 10`, `Then ${tenths} tenths: that × ${tenths}`] },
      own: { strand: 'frac', at: 40 }, facts: { ...top, form, sold: P.sold, share: P.share, pay: P.pay }, size: tenths > 1 && !half ? 2 : 1,
    }, rand));
  }
  return done(ownOrder({
    key: 'payout:percent',
    story: `The haul sold for ${say(P.sold)} credits. Your contract pays you ${P.share}% of it.`,
    ask: 'How many credits is your pay?',
    right: N(P.pay, CREDIT),
    slips: [
      { ...N(P.sold - P.pay, CREDIT), slip: 'rest', why: `That is the other ${100 - P.share}%: the crew's and the captain's.` },
      { ...N(P.share, CREDIT), slip: 'percentCount', why: `${P.share}% isn't ${P.share} credits. It means ${P.share} out of every 100: 10% of ${say(P.sold)} is ${say(one)}.` },
      ...(tenths > 1 ? [{ ...N(one, CREDIT), slip: 'tenOnly', why: `${say(one)} credits is 10%. ${P.share}% is ${tenths} lots of that.` }] : [{ ...N(P.sold / 100, CREDIT), slip: 'onePercent', why: `That is 1%: one part in 100. 10% is one part in 10.` }]),
      { ...N(P.pay + one, CREDIT), slip: 'tenOff', why: `That is 10% too much: ${P.share + 10}%.` },
      { ...N(P.pay / 2, CREDIT), slip: 'half', why: `That is ${P.share / 2}%, half of your share.` },
      { ...N(P.pay + 1000, CREDIT), slip: 'off', why: 'A thousand too many. Work it out again.' },
    ].filter((s) => Number.isInteger(s.v)),
    rightWhy: tenths === 1 ? `10% of ${say(P.sold)} is ${say(P.sold)} ÷ 10 = ${say(P.pay)} credits` : `10% of ${say(P.sold)} is ${say(one)}, so ${P.share}% is ${tenths} × ${say(one)} = ${say(P.pay)} credits`,
    sum: tenths === 1 ? { op: 'div', a: P.sold, b: 10, say: '10% is a tenth of it' } : [{ op: 'div', a: P.sold, b: 10, say: 'First 10%: a tenth of it' }, { op: 'mul', a: one, b: tenths, say: `Then ${P.share}% is ${tenths} lots of 10%` }],
    lines: [...payoutLines(P, 'pay').slice(0, -2), ['Your share', `${who}: ${P.share}%`], ['Your pay', '?']],
    help: { title: 'Ten percent first', pic: { kind: 'sharebar', whole: P.sold, n: tenths, d: 10, pct: true },
      line: `10% is one part in ten. Find 10% of the ${say(P.sold)} credits${tenths === 1 ? '' : `, then take ${tenths} lots of it`}.`,
      steps: tenths === 1 ? [`10% of it: ${say(P.sold)} ÷ 10`] : [`First 10%: ${say(P.sold)} ÷ 10`, `Then ${P.share}%: that × ${tenths}`] },
    own: { strand: 'pct', at: 58 }, facts: { ...top, form, sold: P.sold, share: P.share, pay: P.pay }, size: tenths > 1 ? 2 : 1,
  }, rand));
}

// ── the captains' offers, this visit, and the crew member's own contract ──
function makeMissions() {
  const states = new Map(), fns = [], goFns = [];
  const tell = (list, captain, yes) => { for (const f of list) { try { f(captain, yes); } catch (e) { console.error(e); } } };
  return {
    state(id, crew = null) { const m = crew ? contractOf(crew) : null; return m && m.captain === id ? m.state : states.get(id) || 'new'; },
    asked(id) { if (!states.has(id)) states.set(id, 'asked'); },
    answer(captain, yes) { states.set(captain.id, yes ? 'interested' : 'declined'); tell(fns, captain, yes); },
    // (the contract's card put away unsigned: the offer stays open, and the captain asks again another time)
    declined(id) { states.set(id, 'declined'); },
    go(captain, yes) { tell(goFns, captain, yes); },
    on(fn) { fns.push(fn); },
    onGo(fn) { goFns.push(fn); },
    ready: (id) => !!missionOf(id),
  };
}
export const missions = makeMissions();
