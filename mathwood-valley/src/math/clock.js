// TIME at the store counter: the Time strand's maker (map `time` in src/math/strands.js, points 10 15 20 24 30 32 40
// 48 56). The store has a tall grandfather clock; a customer asks what it says, or how long something takes. The kid
// taps one of 4 answers. src/math/counter.js turns what this makes into an order slip; src/ui/clockface.js draws the
// clock, src/ui/counterpics.js the other pictures.
//
// The steps (STEPS below):
//   1 (10) the clock to the hour (3 o'clock)            the clock drawn on the slip, the answer read off it
//   2 (15) half past (half past 4 = 4:30)
//   3 (20) quarter past and quarter to (7:45 = quarter to 8)
//   4 (24) five minutes at a time (10:25)
//   5 (30) to the minute (7:43)
//   6 (32) how many hours from one time to another (9 in the morning to 2 in the afternoon)
//   7 (40) am and pm, past noon and midnight: "went to bed at 9:30 pm and got up at 5:30 am to milk the cows: how much
//          sleep?", or what time it will be 5 hours from now
//   8 (48) hours and minutes: in the oven at 10:45 am for 1 hour 35 minutes; 135 minutes in hours and minutes; how long
//          from 8:40 am to 11:15 am
//   9 (56) timetables (the stagecoach's) and across days (leaves Monday 8:00 pm, 30 hours on the road)
// The wrong answers are the slips kids really make reading a clock: the long hand read as the hour, the hour hand that
// is nearly at the next number read as that hour, the number the long hand points at read as the minutes (the 3 as 3
// minutes, not 15); and with lengths of time: the smaller hour taken from the bigger across midnight (9 − 5 = 4), the
// wrong way round the clock, the hour marks counted instead of the hops between them, 80 minutes left uncarried
// (10:45 + 1:35 = 11:80), an hour taken as 100 minutes (11:15 − 8:40 = 2 h 75 min), am for pm. The helper after a
// miss: the clock with the minutes written round its edge, or a time line with a hop for each hour (never the answer).
//
//   make(t, step, f, { frac }) -> core (see src/math/counter.js); STEPS: [{ label }]
import { u, clock, ampm, hour12, dur, saidAs, DAYS } from './counterkit.js';

export const STEPS = [
  { label: 'The clock to the hour (3 o\'clock)' },
  { label: 'Half past (half past 4)' },
  { label: 'Quarter past and quarter to' },
  { label: 'Five minutes at a time (10:25)' },
  { label: 'To the minute (7:43)' },
  { label: 'How many hours from one time to another' },
  { label: 'Past noon and midnight (to bed at 9:30 pm, up at 5:30 am)' },
  { label: 'Hours and minutes (1 hour 35 minutes in the oven)' },
  { label: 'Timetables, and across days' },
];

const nextH = (h) => (h === 12 ? 1 : h + 1);
const prevH = (h) => (h === 1 ? 12 : h - 1);
const HOURS = ['hour', 'hours'];
// coin faces: a clock time (the way it's said under it, on the reading steps up to 4), a length of time, a plain label
const tf = (h, m, said) => ({ v: `t${h}:${m}`, big: clock(h, m), small: said ? saidAs(h, m) : '', label: clock(h, m) });
const D = (min) => ({ v: `d${min}`, big: dur(min), small: '', label: dur(min) });
const W = (label) => ({ v: label, big: label, small: '', label });
const flipAP = (s) => s.replace(/(am|pm)$/, (x) => (x === 'am' ? 'pm' : 'am'));
const LOOKS = ['looks up at the store\'s grandfather clock', 'checks the big grandfather clock by the door', 'squints at the grandfather clock behind the counter'];

// 1 to 5: read the grandfather clock
function reading(t, f, step) {
  const said = step <= 4;
  for (let tries = 0; tries < 60; tries++) {
    const h = t.int(1, 12);
    let m = 0;
    if (step === 2) m = 30;
    else if (step === 3) m = t.pick([15, 45, 15, 45, 30]);
    else if (step === 4) m = 5 * t.pick([1, 2, 4, 5, 7, 8, 10, 11]);
    else if (step === 5) { m = t.int(1, 59); if (m % 5 === 0) continue; }
    const slips = [];
    if (step === 1) {
      if (h !== 12) slips.push({ ...tf(12, 0, said), slip: 'longHand', why: 'The long hand is the minute hand: on the 12 it means o\'clock. The short hand points to the hour.' });
      slips.push({ ...tf(nextH(h), 0, said), slip: 'hourOff', why: 'Look again at the number the short hand points to: that is the hour.' },
        { ...tf(prevH(h), 0, said), slip: 'hourOff', why: 'Look again at the number the short hand points to: that is the hour.' });
    } else if (step === 2) {
      slips.push({ ...tf(nextH(h), 30, said), slip: 'nextHour', why: `The short hand is halfway from ${h} to ${nextH(h)}. It has passed ${h}, not ${nextH(h)} yet: it's still ${h}-something.` });
      if (h !== 6) slips.push({ ...tf(6, 0, said), slip: 'longHand', why: 'The long hand on the 6 means 30 minutes: halfway round the clock. It is not 6 o\'clock.' });
      slips.push({ ...tf(h, 6, said), slip: 'numberAsMinutes', why: 'The long hand on the 6 is 30 minutes, not 6: count by 5s from the 12 (5, 10, 15 ... 30).' },
        { ...tf(h, 0, said), slip: 'oclock', why: 'The long hand isn\'t on the 12, so it\'s not o\'clock. It is on the 6: halfway round.' });
    } else {
      const k = m / 5;
      if (m >= 35) slips.push({ ...tf(nextH(h), m, said), slip: 'nextHour', why: `The short hand is nearly at ${nextH(h)}, but it hasn't got there yet: it's still ${h}-something.` });
      if (Number.isInteger(k) && k !== m) slips.push({ ...tf(h, k, said), slip: 'numberAsMinutes', why: `The long hand is on the ${k}, which means ${m} minutes: count by 5s from the 12.` });
      // the hands swapped: the long hand read as the hour, the short one as the minutes
      const sw = Math.floor(m / 5) || 12, swm = (h % 12) * 5;
      if (sw !== h || swm !== m) slips.push({ ...tf(sw, swm, said), slip: 'swapped', why: 'That swaps the hands. The short hand tells the hour; the long hand tells the minutes.' });
      if (step === 5) {
        slips.push({ ...tf(h, m === 59 ? 57 : m + 1, said), slip: 'tickOff', why: 'Count the little marks again, one minute each, from the last number the long hand passed.' },
          { ...tf(h, m >= 5 ? m - 5 : m + 5, said), slip: 'fiveOff', why: 'Count by 5s again to the last number the long hand passed, then the little marks.' });
        if (m > 30) slips.push({ ...tf(h, 60 - m, said), slip: 'backwards', why: 'That counts the minutes backwards from the 12. Minutes count round the way the hands go.' });
      } else {
        slips.push({ ...tf(h, m === 55 ? 50 : m + 5, said), slip: 'fiveOff', why: 'Count by 5s again from the 12 round to the long hand.' },
          { ...tf(prevH(h), m, said), slip: 'lastHour', why: `The short hand has passed ${h}: it's ${h}-something now.` });
      }
    }
    const reads = m ? `the short hand is past ${h} and the long hand says ${m} minutes` : `the short hand is on the ${h} and the long hand on the 12`;
    return {
      key: `time:read:${step}`, story: `${f.name} ${t.pick(LOOKS)}.`, ask: 'What time does it say?',
      right: tf(h, m, said), slips,
      lead: { kind: 'clock', h, m }, pic: { kind: 'clock', h, m, help: true },
      rightWhy: `${reads[0].toUpperCase() + reads.slice(1)}: ${clock(h, m)}${said || m % 15 === 0 ? `, ${saidAs(h, m)}` : ''}`,
      credit: [], facts: { h, m }, read: `${f.name} is looking at the grandfather clock. What time does it say?`,
    };
  }
  return null;
}

// 6: whole hours from one time to another (from the morning into the afternoon later in the step)
function hours(t, f, frac) {
  const across = t.chance(0.25 + 0.6 * frac);
  const a = across ? t.int(7, 11) : t.int(1, 8), b = across ? t.int(1, 5) : t.int(a + 2, 11), len = across ? 12 - a + b : b - a;
  const ctx = t.pick([
    { key: 'stage', s: (A, B) => `The stagecoach left at ${A} and pulled in at ${B}.`, ask: 'How many hours was it on the road?' },
    { key: 'mill', s: (A, B) => `${f.name} started work at the mill at ${A} and stopped at ${B}.`, ask: `How many hours did ${f.she ? 'she' : 'he'} work?` },
    { key: 'fair', s: (A, B) => `The county fair opens at ${A} and closes at ${B}.`, ask: 'How many hours is it open?' },
  ]);
  const story = across ? ctx.s(`${a} o'clock in the morning`, `${b} o'clock in the afternoon`) : ctx.s(`${a} o'clock`, `${b} o'clock`);
  const H = (n) => ({ v: n, big: String(n), small: n === 1 ? 'hour' : 'hours', label: u(n, HOURS) });
  return {
    key: `time:hours:${ctx.key}`, story, ask: ctx.ask, right: H(len),
    slips: [
      { ...H(Math.abs(a - b)), slip: 'subtracted', why: across ? 'Past noon the clock starts again at 1. Count on from the morning time, past 12, to the afternoon one.' : 'Count on from the first time to the second, an hour at a time.' },
      { ...H(len + 1), slip: 'marks', why: 'That counts the hours on the clock face. Count the hops from one hour to the next instead.' },
      { ...H(a + b), slip: 'added', why: 'Adding the two times doesn\'t say how long. Count on from the first time to the second.' },
      { ...H(len - 1), slip: 'short', why: 'One hour short. Count the hops again.' },
    ].filter((s) => s.v > 0),
    pic: { kind: 'timeline', from: a * 60, to: (across ? 12 + b : b) * 60, noon: across, plain: !across },
    rightWhy: across ? `From ${a} to 12 noon is ${u(12 - a, HOURS)}, then on to ${b} is ${b} more: ${u(len, HOURS)}` : `From ${a} o'clock on to ${b} o'clock: ${u(len, HOURS)}`,
    // (Work it out: the hours on from the first time to the second; across noon, up to 12 first, then on)
    sum: across ? [{ op: 'sub', a: 12, b: a, say: `First from ${a} in the morning up to 12 noon` }, { op: 'add', a: 12 - a, b, say: `Then on to ${b} in the afternoon` }]
      : { op: 'sub', a: b, b: a, say: `The hours from ${a} o'clock on to ${b} o'clock` },
    credit: [], facts: { a, b, across, len },
  };
}

// 7: across noon or midnight with am and pm: the night's sleep, or what time it will be
function ampmStep(t, f, frac) {
  if (t.chance(0.55)) {
    // the night's sleep: to bed at night, up early to milk the cows (half hours later in the step)
    const half = t.chance(0.15 + 0.6 * frac);
    const bedH = t.int(8, 11), bedM = t.pick([0, 30]), upH = t.int(4, 7), upM = half ? 30 - bedM : bedM;
    const bed = (bedH + 12) * 60 + bedM, up = 24 * 60 + upH * 60 + upM, sleep = up - bed;
    const off = 'One hour off. Count the hops again: to midnight, then on to the morning.';
    return {
      key: `time:sleep:${bedH}${upH}`, story: `${f.name} went to bed at ${clock(bedH, bedM)} pm and had to get up at ${clock(upH, upM)} am to milk the cows.`,
      ask: `How much sleep did ${f.she ? 'she' : 'he'} get?`, right: D(sleep), wide: true,
      slips: [
        { ...D(Math.abs(bedH * 60 + bedM - (upH * 60 + upM))), slip: 'subtracted', why: `That takes ${upH} from ${bedH}. Count on from ${clock(bedH, bedM)} at night, past midnight, to ${clock(upH, upM)} in the morning.` },
        { ...D(1440 - sleep), slip: 'wrongWay', why: `That's from ${clock(upH, upM)} in the morning round to ${clock(bedH, bedM)} at night: the hours awake, not asleep.` },
        { ...D(sleep + 60), slip: 'off', why: off }, { ...D(sleep - 60), slip: 'off', why: off },
        { ...D((bedH + upH) * 60 + bedM + upM), slip: 'added', why: 'Adding the two times doesn\'t say how long. Count the hours from bedtime on.' },
      ],
      pic: { kind: 'timeline', from: bed, to: up, midnight: true },
      rightWhy: `${clock(bedH, bedM)} pm to midnight is ${dur(24 * 60 - bed)}, then ${dur(up - 24 * 60)} more to ${clock(upH, upM)} am: ${dur(sleep)}`,
      credit: [], size: 2, facts: { bed, up, sleep },
    };
  }
  // what time it will be: some hours on from now, past noon (or past midnight)
  const night = t.chance(0.3);
  const startH = t.int(8, 11), m = frac < 0.5 ? 0 : t.pick([0, 15, 30, 45]);
  const start = (night ? startH + 12 : startH) * 60 + m, add = t.int(13 - startH, 8) * 60, end = start + add;
  const ctx = night
    ? { s: `The night train leaves the depot at ${ampm(start)}, and the ride to Tucson takes ${u(add / 60, HOURS)}.`, ask: 'What time does it get in?' }
    : { s: `It's ${ampm(start)} at the store, and the barn dance starts ${u(add / 60, HOURS)} from now.`, ask: 'What time does the dance start?' };
  return {
    key: `time:later:${night ? 'train' : 'dance'}`, story: ctx.s, ask: ctx.ask, right: W(ampm(end)), wide: true,
    slips: [
      { ...W(flipAP(ampm(end))), slip: 'ampm', why: night ? 'Past midnight it\'s am: the morning.' : 'Past 12 noon it\'s pm: the afternoon and evening.' },
      { ...W(`${hour12(start) + add / 60}:${String(m).padStart(2, '0')} ${start < 720 ? 'am' : 'pm'}`), slip: 'noWrap', why: 'A clock only goes up to 12, then starts again at 1. Count on round the clock.' },
      { ...W(ampm(end + 60)), slip: 'off', why: 'One hour off. Count the hours on again, one hop at a time.' },
      { ...W(ampm(end - 60)), slip: 'off', why: 'One hour off. Count the hours on again, one hop at a time.' },
    ],
    pic: { kind: 'timeline', from: start, to: null, add, midnight: night, noon: !night },
    rightWhy: `${ampm(start)} and ${u(add / 60, HOURS)} on is ${ampm(end)}`,
    credit: [], size: 2, facts: { start, add, end },
  };
}

// 8: hours and minutes: minutes into hours, a time plus a length of time, or how long between two times
function hoursMinutes(t, f, frac) {
  const form = t.pick(frac < 0.4 ? ['bake', 'minutes'] : ['bake', 'minutes', 'between']);
  if (form === 'minutes') {
    const h = t.int(1, 3), m = 5 * t.int(1, 11), total = h * 60 + m, s = String(total);
    const slips = [
      { ...D(total + 60), slip: 'off', why: `${u(h + 1, HOURS)} is ${(h + 1) * 60} minutes already, more than ${total}.` },
      { ...D(h * 60 + (m + 10 < 60 ? m + 10 : m - 10)), slip: 'minutesOff', why: `${u(h, HOURS)} is ${h * 60} minutes. How many are left over from ${total}?` },
    ];
    if (total > 60) slips.push({ ...D(total - 60), slip: 'off', why: `Count the 60s in ${total}: 60, 120, 180 ... then the minutes left over.` });
    if (s.length === 3 && Number(s.slice(1)) < 60 && Number(s[0]) * 60 + Number(s.slice(1)) !== total) {
      const hh = Number(s[0]), mm = Number(s.slice(1));
      slips.unshift({ v: `x${s}`, big: `${hh} h ${mm} min`, small: '', label: `${hh} h ${mm} min`, slip: 'hundreds', why: `That reads ${total} like money, the first digit as hours. An hour is 60 minutes, not 100.` });
    }
    return {
      key: 'time:minutes', story: `${f.name}'s stew has to simmer for ${total} minutes.`, ask: 'How long is that in hours and minutes?', right: D(total), wide: true,
      slips, pic: { kind: 'hourbars', total },
      rightWhy: `${u(h, HOURS)} is ${h * 60} minutes, and ${m} more makes ${total}: ${dur(total)}`,
      sum: { op: 'div', a: total, b: 60, say: 'How many 60s (whole hours) are in it, and the minutes left over' },
      credit: [], facts: { total },
    };
  }
  if (form === 'between') {
    for (let tries = 0; tries < 80; tries++) {
      const a = t.int(7, 9) * 60 + 5 * t.int(1, 11), len = t.int(1, 3) * 60 + 5 * t.int(1, 11), b = a + len;
      if (b % 60 >= a % 60 || b >= 12 * 60) continue;   // (the minutes must borrow an hour: 8:40 to 11:15, all in the morning)
      const hDiff = Math.floor(b / 60) - Math.floor(a / 60), flipped = hDiff * 60 + (a % 60) - (b % 60);
      const hundred = (Math.floor(b / 60) * 100 + (b % 60)) - (Math.floor(a / 60) * 100 + (a % 60));
      return {
        key: 'time:between', story: `The stage left the depot at ${ampm(a)} and got to the fort at ${ampm(b)}.`, ask: 'How long was the ride?', right: D(len), wide: true,
        slips: [
          { v: `x${hundred}`, big: `${Math.floor(hundred / 100)} h ${hundred % 100} min`, small: '', label: `${Math.floor(hundred / 100)} h ${hundred % 100} min`, slip: 'hundred', why: 'An hour is 60 minutes, not 100. Count on to the next hour first, then on.' },
          { ...D(flipped), slip: 'flipped', why: `${b % 60} take away ${a % 60} won't go, so it was turned round. Count on to the next hour first, then on to ${ampm(b)}.` },
          { ...D(len + 60), slip: 'hourOff', why: 'One hour too many. Count on to the next hour, then the whole hours, then the minutes.' },
          { ...D(len - 5), slip: 'off', why: 'Five minutes short. Count on to the next hour, then on.' },
        ],
        pic: { kind: 'timeline', from: a, to: b },
        rightWhy: `${ampm(a)} to ${ampm(Math.ceil(a / 60) * 60)} is ${dur(Math.ceil(a / 60) * 60 - a)}, then on to ${ampm(b)} is ${dur(b - Math.ceil(a / 60) * 60)}: ${dur(len)}`,
        credit: [], size: 2, facts: { a, b, len },
      };
    }
  }
  // in the oven at 10:45 am for 1 hour 35 minutes -> 12:20 pm
  for (let tries = 0; tries < 80; tries++) {
    const start = t.int(8, 11) * 60 + 5 * t.int(5, 11), len = t.int(1, 2) * 60 + 5 * t.int(3, 11), end = start + len;
    if ((start % 60) + (len % 60) < 60) continue;   // (the minutes go past 60: an hour is carried)
    const sh = Math.floor(start / 60) % 12 || 12, raw = `${sh + Math.floor(len / 60)}:${(start % 60) + (len % 60)} ${start < 720 ? 'am' : 'pm'}`;
    const what = t.pick([['the bread', 'goes into the oven', 'bakes', 'they', 'come out'], ['the pies', 'go into the oven', 'bake', 'they', 'come out'],
      ['the ham', 'goes on the smoker', 'smokes', 'it', 'come off']]);
    const slips = [{ ...W(raw), slip: 'noCarry', why: `There's no ${(start % 60) + (len % 60)} minutes past the hour: 60 minutes make an hour, so carry the hour.` }];
    if (Math.floor(start / 720) !== Math.floor(end / 720)) slips.push({ ...W(flipAP(ampm(end))), slip: 'ampm', why: 'Past 12 noon it\'s pm: the afternoon.' });
    slips.push({ ...W(ampm(end - 60)), slip: 'hourLost', why: 'The minutes went past 60: that makes one more hour.' },
      { ...W(ampm(end + 10)), slip: 'off', why: 'Ten minutes off. Count on to the next hour first, then on.' });
    return {
      key: `time:bake:${what[0]}`, story: `At the hotel, ${what[0]} ${what[1]} at ${ampm(start)} and ${what[2]} for ${u(Math.floor(len / 60), HOURS)} ${len % 60} minutes.`,
      ask: `What time should ${what[3]} ${what[4]}?`, right: W(ampm(end)), wide: true, slips,
      pic: { kind: 'timeline', from: start, to: null, add: len },
      rightWhy: `${ampm(start)} on to ${ampm(Math.ceil(start / 60) * 60)} is ${60 - (start % 60)} minutes; the rest of the ${dur(len)} takes it to ${ampm(end)}`,
      credit: [], size: 2, facts: { start, len, end },
    };
  }
  return null;
}

// 9: the stagecoach's timetable, or a long trip across days
const STOPS = ['Yuma', 'Gila Bend', 'Maricopa Wells', 'Pima Station', 'Tucson', 'Fort Bowie'];
function timetable(t, f, frac) {
  if (t.chance(0.5)) {
    for (let tries = 0; tries < 80; tries++) {
      const first = frac > 0.5 ? 1 : 0, stops = [];
      let at = t.int(6, 8) * 60 + 5 * t.int(0, 11);
      for (let i = 0; i < 4; i++) { stops.push([STOPS[i + first], at]); at += t.int(2, 4) * 60 + 5 * t.int(1, 11); }
      const i = t.int(0, 2), j = t.int(i + 1, Math.min(3, i + 2)), A = stops[i][1], B = stops[j][1], len = B - A;
      if (len % 60 === 0) continue;
      const hDiff = Math.floor(B / 60) - Math.floor(A / 60), mDiff = (B % 60) - (A % 60);
      return {
        key: `time:table:${i}${j}`, story: `${f.name} reads the stagecoach timetable on the store wall.`, ask: `How long is the ride from ${stops[i][0]} to ${stops[j][0]}?`,
        right: D(len), wide: true,
        slips: [
          mDiff < 0 ? { ...D(hDiff * 60 - mDiff), slip: 'flipped', why: 'The minutes were taken the wrong way round. Count on to the next whole hour first, then on.' }
            : { ...D(len + 10), slip: 'off', why: 'Ten minutes off. Count on again from the first time.' },
          { ...D(len + 60), slip: 'off', why: 'One hour too many. Count on to the next whole hour, then on.' },
          { ...D(len > 60 ? len - 60 : len + 120), slip: 'off', why: 'Count the whole hours again, then the minutes.' },
          { ...D(len - 5), slip: 'off', why: 'Five minutes off. Count on again.' },
        ],
        lead: { kind: 'timetable', stops: stops.map(([s, m]) => [s, ampm(m)]), mark: [i, j] },
        pic: { kind: 'timeline', from: A, to: B },
        rightWhy: `${ampm(A)} to ${ampm(B)} is ${dur(len)}`,
        credit: [], size: 2, facts: { from: A, to: B, len },
      };
    }
    return null;
  }
  // across days: leaves Monday at 8:00 pm, 30 hours on the road
  const day = t.int(1, 4), startH = t.pick([6, 7, 8, 9, 10]) + (t.chance(0.6) ? 12 : 0);
  let len = t.pick([18, 20, 26, 30, 32, 36, 40]);
  if ((startH + len) % 24 === 0) len += 2;   // (not exactly at midnight: "Tuesday 12:00 am" reads oddly)
  const start = day * 1440 + startH * 60, end = start + len * 60;
  const when = (mins) => `${DAYS[Math.floor(mins / 1440) % 7]} ${ampm(mins)}`;
  const long = len >= 24;
  return {
    key: `time:days:${len}`, story: `The freight wagon leaves on ${when(start)}, and the trip to Santa Fe takes ${len} hours.`, ask: 'When does it get there?',
    right: W(when(end)), wide: true,
    slips: [
      { ...W(when(end - 1440)), slip: 'dayLost', why: long ? `24 of the ${len} hours make a whole day. Count the day, then the ${len - 24} hours left.` : 'Past midnight it\'s the next day.' },
      { ...W(flipAP(when(end))), slip: 'ampm', why: 'Check am or pm: count the hours on, past noon and midnight.' },
      { ...W(when(end + 1440)), slip: 'dayExtra', why: long ? `${len} hours is one day and ${len - 24} hours, not two days.` : `${len} hours is less than a whole day.` },
      { ...W(when(end - 120)), slip: 'off', why: 'Two hours short. Count the hours on again.' },
    ],
    pic: { kind: 'days', start, len },
    rightWhy: long ? `${len} hours is a day and ${len - 24} hours: ${when(start)} + 24 hours is ${when(start + 1440)}, and ${len - 24} more is ${when(end)}`
      : `${when(start)} on to midnight is ${24 - startH} hours, and ${len - 24 + startH} more is ${when(end)}`,
    credit: [], size: 2, facts: { start, len, end },
  };
}

export function make(t, step, f, { frac = 0 } = {}) {
  const s = Math.max(1, Math.min(STEPS.length, step));
  if (s <= 5) return reading(t, f, s);
  if (s === 6) return hours(t, f, frac);
  if (s === 7) return ampmStep(t, f, frac);
  if (s === 8) return hoursMinutes(t, f, frac);
  return timetable(t, f, frac);
}
