// MEDICAL, at the triage desk in the medical centre: a medic's math, kept friendly (bumped knees, space sniffles,
// the station's cat). Counting pills and plasters for the youngest, then pills a day for so many days, a dose for
// every kilogram, a drip bag run evenly over some hours, sharing out, whole boxes, a dose from a ratio table ("2 mL
// for every 5 kg"), a mix by a ratio, proportions, and at the top a drip's drops a minute. Mathwood Valley's question
// makers (engine.js) tell most of them through SETTING; the drip rates are this job's own maker (drip, below).
// The scene: a patient chart on the panel; the desk, the stretcher trolley and the beds are the station's own
// (kit/rooms/station.json: the medical centre's desk and cabinStretcher, the ward's beds).
import { ownOrder } from './engine.js';

const u = (n, unit) => `${n} ${n === 1 ? unit[0] : unit[1]}`;

// the patients (Mathwood's FOLK shape), each with what brought them in: never anything scary
const FOLK = [
  { name: 'Pilot Juno', she: true, why: 'Space sniffles' }, { name: 'Ensign Moss', she: false, why: 'Bumped a knee in zero-g' },
  { name: 'Engineer Okafor', she: false, why: 'A sore wrist from the wrench' }, { name: 'Navigator Sela', she: true, why: 'A tickly cough' },
  { name: 'Cook Raffi', she: false, why: 'A small burn from the oven' }, { name: 'Cadet Pim', she: true, why: 'A wobbly tooth' },
  { name: 'Dock Chief Ibarra', she: false, why: 'Hay fever from the grow pods' }, { name: 'Miner Kestrel', she: true, why: 'Dust in the eyes' },
];

export const SETTING = {
  folk: FOLK,
  things: [
    { key: 'pills', unit: ['pill', 'pills'], shape: 'egg' },
    { key: 'tins', unit: ['tin of plasters', 'tins of plasters'], shape: 'can', short: ['tin', 'tins'] },
    { key: 'apples', unit: ['apple', 'apples'], shape: 'apple' },
  ],
  kmoreHow: [({ b }) => `The pharmacy sends ${b} more.`, ({ b }) => `A supply drone brings ${b} more.`, ({ b, p }) => `${p.They} finds ${b} more in the cupboard.`],
  kleftHow: [({ b, p }) => `${p.They} gave ${b} to patients.`, ({ b }) => `${b} were used on the ward today.`],
  kgroups: ({ g, e, th }) => `The medic sets out ${g} trays with ${u(e, th.unit)} on each tray.`,
  groups: [
    { key: 'pills', item: ['day', 'days'], unit: ['pill', 'pills'], story: ({ a, b, f }) => `${f.name} has to take ${b} vitamin pills a day for ${a} days.`, ask: () => 'How many pills is that?' },
    { key: 'cat', item: ['kilogram', 'kilograms'], unit: ['mL', 'mL'], story: ({ a, b }) => `Comet, the station's cat, weighs ${a} kg. The cat medicine is ${b} mL for every kilogram.`, ask: () => 'How many mL does Comet need?' },
    { key: 'plasters', item: ['patient', 'patients'], unit: ['plaster', 'plasters'], story: ({ a, b }) => `${a} cadets scraped their elbows playing zero-g tag. Each one needs ${b} plasters.`, ask: () => 'How many plasters is that?' },
  ],
  share: [
    { key: 'drip', thing: ['mL', 'mL'], box: ['hour', 'hours'], story: ({ total, groups }) => `A drip bag holds ${total} mL. It has to run evenly over ${groups} hours.`, ask: 'How many mL go in each hour?' },
    { key: 'pills', thing: ['pill', 'pills'], box: ['patient', 'patients'], story: ({ total, groups }) => `The pharmacy shares ${total} vitamin pills evenly among ${groups} patients.`, ask: 'How many pills does each patient get?' },
    { key: 'ice', thing: ['ice pack', 'ice packs'], box: ['bed', 'beds'], story: ({ total, groups }) => `There are ${total} ice packs for the ${groups} beds in the ward, the same at every bed.`, ask: 'How many ice packs go to each bed?' },
  ],
  crates: [
    { key: 'bandages', box: ['box', 'boxes'], story: ({ total, per }) => `The ward needs ${total} bandages. Bandages come in boxes of ${per}.`, ask: 'How many boxes should the medic open so there are enough?' },
    { key: 'masks', box: ['pack', 'packs'], story: ({ total, per }) => `${total} crew are getting their check-up, and masks come in packs of ${per}.`, ask: 'How many packs so everyone gets a mask?' },
  ],
  partsLeft: [
    { key: 'pillsLeft', unit: ['pill', 'pills'], story: ({ a, b }) => `The pharmacy had ${a} cough pills this morning. It gave out ${b} of them.`, ask: 'How many cough pills are left?' },
    { key: 'dripLeft', unit: ['mL', 'mL'], story: ({ a, b, f }) => `${f.name}'s drip bag had ${a} mL in it. ${b} mL have dripped in so far.`, ask: 'How many mL are still in the bag?' },
  ],
  partsTogether: [
    { key: 'patients', unit: ['patient', 'patients'], story: ({ a, b }) => `The medical centre saw ${a} patients in the morning and ${b} in the afternoon.`, ask: 'How many patients came in all?' },
    { key: 'bandagesIn', unit: ['bandage', 'bandages'], story: ({ a, b }) => `Two supply drones brought bandages: ${a} in one and ${b} in the other.`, ask: 'How many bandages came in?' },
  ],
  tables: [
    { key: 'dose', top: ['kilogram', 'kilograms'], bot: ['mL of medicine', 'mL of medicine'], botShort: ['mL', 'mL'], s: (a, b) => `The dose is ${a} mL of medicine for every ${b} kg the patient weighs.` },
    { key: 'mg', top: ['kilogram', 'kilograms'], bot: ['mg of medicine', 'mg of medicine'], botShort: ['mg', 'mg'], s: (a, b) => `The fever medicine is ${a} mg for every ${b} kg of the patient's weight.` },
    { key: 'cream', top: ['scrape', 'scrapes'], bot: ['dab of cream', 'dabs of cream'], botShort: ['dab', 'dabs'], s: (a, b) => `The medic uses ${a} dabs of healing cream for every ${b} scrapes.` },
  ],
  shares: {
    names: [['water', 'medicine'], ['saline', 'medicine'], ['juice', 'medicine']],
    what: [['mL', 'mL', 'mL', 'mL']],
    story: ({ x, y, total, a, b }) => `The medic mixes ${a} ${a === 1 ? 'part' : 'parts'} ${x} to ${b} ${b === 1 ? 'part' : 'parts'} ${y}, ${total} mL in all.`,
    ask: ({ who }) => `How many mL of ${who}?`,
  },
  proportions: [
    ({ n, d, D }) => ({ key: 'mix', s: `In the drip mix, ${n} of every ${d} mL ${n === 1 ? 'is' : 'are'} medicine. The bag holds ${D} mL.`, ask: 'How many mL of medicine are in the bag?', unit: ['mL', 'mL'], what: 'medicine' }),
    ({ n, d, D }) => ({ key: 'flu', s: `${n} of every ${d} crew on the station ${n === 1 ? 'has' : 'have'} had the space-flu shot. ${D} crew live aboard.`, ask: 'How many have had it?', unit: ['crew member', 'crew members'], what: 'had it' }),
    ({ n, d, D }) => ({ key: 'checks', s: `${n} of every ${d} check-ups this month ${n === 1 ? 'was' : 'were'} for a cold. There were ${D} check-ups.`, ask: 'How many were for a cold?', unit: ['check-up', 'check-ups'], what: 'a cold' }),
  ],
};

// ── this job's own maker: drip rates ─────────────────────────────────────────────────────────────────────────────
// step 1: the rate, in mL an hour: a 400 mL bag over 8 hours runs at 50 mL an hour (a rate, as Mathwood's miles an
//         hour; the bag shared evenly over the hours)
// step 2: the drops a minute a medic counts: 120 mL an hour, with a tube that makes 20 drops a mL, is 2,400 drops an
//         hour, so 40 a minute (two steps; the wrong answers forget the 60 minutes, or use the mL and not the drops)
const RATES = [25, 50, 75, 100, 125, 150, 200, 250];
const ML_H = ['mL an hour', 'mL an hour'], DROPS = ['drop a minute', 'drops a minute'];
const C = (n, unit) => ({ v: n, big: n.toLocaleString('en-US'), small: n === 1 ? unit[0] : unit[1], label: u(n, unit) });

export const MAKERS = {
  drip: {
    strand: 'ratio', at: (step) => (step <= 1 ? 42 : 76),
    make(step, { rand = Math.random, who = null } = {}) {
      const pick = (a) => a[Math.floor(rand() * a.length)], int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
      const f = who || pick(FOLK);
      if (step <= 1) {
        const rate = pick(RATES), h = int(2, 8), V = rate * h;
        return ownOrder({
          key: 'drip:rate', story: `${f.name} needs a ${V} mL bag of fluid, run evenly over ${h} hours.`, ask: 'What should the drip rate be, in mL an hour?',
          right: C(rate, ML_H),
          slips: [
            { ...C(V - h, ML_H), slip: 'subtracted', why: `${V} − ${h} takes hours from mL. Share the ${V} mL out over the ${h} hours.` },
            { ...C(V, ML_H), slip: 'whole', why: `${V} mL is the whole bag. It runs for ${h} hours, so each hour gets a part of it.` },
            { ...C(rate + 25, ML_H), slip: 'off', why: `At ${rate + 25} mL an hour, ${h} hours would run ${(rate + 25) * h} mL, more than the bag.` },
            { ...C(rate - 25, ML_H), slip: 'off', why: `At ${rate - 25} mL an hour, ${h} hours would run only ${(rate - 25) * h} mL.` },
            { ...C(h, ML_H), slip: 'swapped', why: `${h} is the hours. The rate is the mL that go in each hour.` },
          ].filter((s) => s.v > 0),
          rightWhy: `${V} mL ÷ ${h} hours = ${rate} mL an hour`,
          sum: { op: 'div', a: V, b: h },
          help: { title: 'The bag, hour by hour', pic: { kind: 'drip', V, h }, line: `Split the ${V} mL into ${h} equal parts, one for each hour: ${V} ÷ ${h}.`, steps: [`The mL in each hour: ${V} ÷ ${h}`] },
          own: { strand: 'ratio', at: 42 }, credit: [{ strand: 'div', at: 37, weight: 0.5 }], facts: { V, h, rate },
        }, rand);
      }
      for (let tries = 0; tries < 60; tries++) {
        const R = pick([30, 60, 90, 120, 150, 180, 240]), F = pick([10, 15, 20, 60]), hour = R * F;
        if (hour % 60) continue;
        const ans = hour / 60;
        return ownOrder({
          key: 'drip:drops', story: `${f.name}'s drip runs at ${R} mL an hour. Its tube makes ${F} drops for every mL.`,
          ask: 'How many drops a minute should the medic count?',
          right: C(ans, DROPS),
          slips: [
            { ...C(hour, DROPS), slip: 'hour', why: `${hour.toLocaleString('en-US')} is the drops in a whole hour. An hour has 60 minutes: share them out.` },
            { ...C(R, DROPS), slip: 'mL', why: `${R} is the mL an hour. Each mL makes ${F} drops, and an hour has 60 minutes.` },
            { ...C(Math.round(R / 60) || F, DROPS), slip: 'noDrops', why: `That's the mL a minute, not the drops. Each mL makes ${F} drops.` },
            { ...C(ans + 10, DROPS), slip: 'off', why: `${ans + 10} a minute would be ${(ans + 10) * 60} drops an hour, not ${hour.toLocaleString('en-US')}.` },
            { ...C(ans * 2, DROPS), slip: 'double', why: `That's twice as fast. ${R} × ${F} drops in an hour, ÷ 60 for a minute.` },
          ].filter((s) => s.v !== ans),
          rightWhy: `${R} × ${F} = ${hour.toLocaleString('en-US')} drops an hour; ÷ 60 = ${ans} drops a minute`,
          sum: [{ op: 'mul', a: R, b: F, say: 'First the drops in an hour' }, { op: 'div', a: hour, b: 60, say: 'Then the drops in each minute (an hour has 60)' }],
          help: { title: 'An hour of drops', pic: { kind: 'drops', R, F }, line: `Every mL makes ${F} drops, so an hour of ${R} mL is ${R} × ${F} drops. An hour has 60 minutes: share the drops out over them.`,
            steps: [`First the drops in an hour: ${R} × ${F}`, 'Then the drops in each minute: that ÷ 60'] },
          own: { strand: 'ratio', at: 76 }, credit: [{ strand: 'long', at: 49, weight: 0.5 }], facts: { R, F, ans }, size: 2,
        }, rand);
      }
      throw new Error('medical drip: nothing made');
    },
  },
};

const K = (step, w = 1) => ({ maker: 'wordsK', step, w });
const W = (step, types, w = 1) => ({ maker: 'words', step, types, w });
const M = (maker, step, w = 1) => ({ maker, step, w });

export const PLACE = {
  id: 'medical', name: 'Medical: the triage desk', short: 'Medical', math: 'A medic\'s math: doses and drips', pic: 'medical', job: null,
  line: 'Patients at the triage desk: pills a day, doses by weight, drip bags and drip rates.',
  levels: [
    { id: 'kAll', title: 'Counting pills', line: '2 pills and 1 more, up to 5', gen: { mix: [K(1)] } },
    { id: 'kLeft', title: 'In all, and left', line: 'Up to 10: 8 plasters, 3 used', gen: { mix: [K(2)] } },
    { id: 'kTrays', title: 'Trays of the same', line: '3 trays with 2 pills on each', gen: { mix: [K(4, 2), K(3)] } },
    { id: 'groups', title: 'Pills a day', line: '2 pills a day for 5 days; patients in the morning and afternoon', gen: { mix: [W(1, ['groups', 'parts'])] } },
    { id: 'share', title: 'Sharing out', line: '24 pills among 4 patients; 48 mL over 6 hours', gen: { mix: [W(2, ['share'], 2), W(1, ['groups'])] } },
    { id: 'dose', title: 'A dose for every kilogram', line: 'Comet weighs 7 kg: 3 mL for every kilogram', gen: { mix: [W(3, ['groups', 'share', 'parts'])] } },
    { id: 'rate', title: 'Drip rates', line: 'A 400 mL bag over 8 hours: mL an hour', gen: { mix: [M('drip', 1, 2), W(3, ['share'])] } },
    { id: 'boxes', title: 'Whole boxes', line: '50 bandages in boxes of 12: open 5', gen: { mix: [W(7, ['share'], 2), M('drip', 1)] } },
    { id: 'table', title: 'Doses by weight', line: '2 mL for every 5 kg; the patient weighs 20 kg', gen: { mix: [M('ratio', 3, 2), M('drip', 1)] } },
    { id: 'mix', title: 'Mixing by a ratio', line: '3 parts water to 1 part medicine, 20 mL in all', gen: { mix: [M('ratio', 4, 2), M('ratio', 3)] } },
    { id: 'prop', title: 'Proportions', line: '1 of every 5 mL is medicine; in a 250 mL bag?', gen: { mix: [M('ratio', 5, 2), M('ratio', 4)] } },
    { id: 'drops', title: 'Drops a minute', line: '120 mL an hour, 20 drops a mL: drops a minute', gen: { mix: [M('drip', 2, 2), M('ratio', 5)] } },
  ],
};

export const JOB = {
  id: 'medical', name: 'The triage desk', short: 'Medical', open: true,
  // where the job is: at the triage desk, facing it
  spot: { place: 'triageDesk' },
  // the camera while it's up: the station's own view of the triage corner (the desk, the bays, the stretcher)
  view: 'medical-triage',
  sign: 'Triage desk', hint: 'Help the patients',
  place: PLACE, setting: SETTING, makers: MAKERS,
  card: 'chart',
};
