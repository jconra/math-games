// THE SURVEYOR'S CARDS, at the Explorer's survey table: the exploring run's own job, as the drill is the mining run's
// (src/missions.js; the plan ~/pw/space-math/EXPLORE_PLAN.md). One ladder like every job's, kids to grown-ups, every
// card about the scan of the land below. The game's maker (2026-11-20, his answers EXP-1 to EXP-4): "it makes sense to
// me to use the survey table and pick up an area of interest (by doing some math) and then jump again to the new
// location and then make the discovery ... So the Explorer does Jump -> Survey -> Jump -> Discovery -> Jump home"; the
// cards are "all of those, and points on the map to pick the places, as the pilot's map has them" (reading charts,
// averages, chance). Pay is for the survey itself, on the run (src/missions.js: the share), never by a card.
//
// The ladder, easiest first (Mathwood's school guide in brackets: 0 starting kindergarten ... 80 eighth grade):
//   the scan's finds counted (0); sorted by kind and counted (4); which kind there is most of (8); a picture chart, one
//   picture a find (10); more, fewer and in all on it (14); a bar chart (20); two bars compared (22); bars counted by
//   2s, 5s and 10s (28); one picture for 2, 5 or 10 (32); a line plot of crystals measured (34); two steps on a bar
//   chart (38); the longest, the shortest and how many over on a line plot (40); certain, likely, unlikely or
//   impossible (44); the ground's warmth through the day, a line graph (48); points on the map, the upper right
//   quarter (50); the average (58); the whole map, with negatives (62); the middle, the most common and the spread
//   (63); how far across the map (64); a missing reading from the average (66); chance as a fraction (70), as a
//   percent (72); about how many probes out of so many (74); two probes at once (78).
// The points on the map are Mathwood Valley's own graph ladder (the Professor's chalkboard: src/math/graphs.js, its
// points, its answers and its walk, "right 2, then up 3"), on the survey's map of the land below, answered as the
// pilot's are: a tap on the spot (src/jobs/panel.js), or one of four answers for a point read off the map. Everything
// else has no maker in either game, so it is this job's own (MAKERS below), in the order shape of every job's
// (engine.js ownOrder): one right answer, wrong answers that are the slips children make, each with one plain line why,
// Help's picture, its line and its steps (never the answer), and the sum where there is one for Work it out on paper.
//
// Every picture is drawn dark with light lines (src/jobs/surveyview.js): the scan, the charts, the map.
//
// WHERE THE SURVEY IS (his EXP-1 pick, "the land below shows on it"): the places named are places on the land below,
// PLACES. If the survey turns out to be of the space round about instead, they are one table to change.
import { ownOrder } from './engine.js';
import { pickPoint, choicesFor, pointText, numText, walkWords } from '../../../mathwood-valley/src/math/graphs.js';
import { scanPic, kindRows, rowsPic, barPic, dotsPic, linePic, readingsPic, gridPic, pairPic, numberLine, landMap } from './surveyview.js';

const say = (n) => Number(n).toLocaleString('en-US');
const u = (n, unit) => `${say(n)} ${n === 1 ? unit[0] : unit[1]}`;
const kit = (rand) => {
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1)), pick = (a) => a[Math.floor(rand() * a.length)];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // n different whole numbers from lo to hi
  const distinct = (n, lo, hi) => shuffle(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)).slice(0, n);
  return { int, pick, shuffle, distinct, chance: (p) => rand() < p };
};

// ── the world of the cards ───────────────────────────────────────────────────────────────────────────────────────
// what the scan finds: three kinds, each its own picture (src/jobs/surveyview.js icon)
export const KINDS = {
  ice: { key: 'ice', name: 'Ice', unit: ['chunk of ice', 'chunks of ice'], what: 'ice' },
  metal: { key: 'metal', name: 'Metal', unit: ['lump of metal', 'lumps of metal'], what: 'metal' },
  crystal: { key: 'crystal', name: 'Crystals', unit: ['crystal', 'crystals'], what: 'crystals' },
};
const KIND_LIST = Object.values(KINDS);
// the places on the land below (its name in a story, its label on a chart)
export const PLACES = [
  { key: 'crater', name: 'the crater', label: 'Crater' }, { key: 'ridge', name: 'the ridge', label: 'Ridge' },
  { key: 'dunes', name: 'the dunes', label: 'Dunes' }, { key: 'valley', name: 'the valley', label: 'Valley' },
  { key: 'plain', name: 'the plain', label: 'Plain' }, { key: 'cliffs', name: 'the cliffs', label: 'Cliffs' },
  { key: 'canyon', name: 'the canyon', label: 'Canyon' }, { key: 'basin', name: 'the basin', label: 'Basin' },
];
// what the probes measure, for the averages: its words, its unit, the range its readings come from
export const READINGS = [
  { key: 'warmth', title: 'The ground\'s warmth', of: 'the ground\'s warmth', unit: ['°C', '°C'], lo: 6, hi: 30, sp: '' },
  { key: 'depth', title: 'How deep the ice lies', of: 'how deep the ice lies', unit: ['metre', 'metres'], lo: 2, hi: 14, sp: ' ' },
  { key: 'length', title: 'Crystals measured', of: 'the length of a crystal', unit: ['centimetre', 'centimetres'], lo: 2, hi: 15, sp: ' ' },
];
const TIMES = ['8:00', '9:00', '10:00', '11:00', '12:00', '1:00'];

// ── the faces on the answer buttons ──────────────────────────────────────────────────────────────────────────────
const C = (n, unit) => ({ v: n, big: say(n), small: n === 1 ? unit[0] : unit[1], label: `${say(n)} ${n === 1 ? unit[0] : unit[1]}` });
const Wd = (v, big) => ({ v, big, small: '', label: big });
const R = (n, rd) => ({ v: n, big: `${say(n)}${rd.unit[0] === '°C' ? ' °C' : ''}`, small: rd.unit[0] === '°C' ? '' : n === 1 ? rd.unit[0] : rd.unit[1], label: `${say(n)} ${n === 1 ? rd.unit[0] : rd.unit[1]}` });
const Fr = (a, b) => ({ v: `${a}/${b}`, big: `${a}/${b}`, small: '', label: `${a}/${b}`, val: a / b });
const Pc = (p) => ({ v: p, big: `${p}%`, small: '', label: `${p}%` });
const reading = (n, rd) => `${say(n)}${rd.unit[0] === '°C' ? ' °C' : ` ${n === 1 ? rd.unit[0] : rd.unit[1]}`}`;
const list = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const step3 = (step, n) => Math.max(1, Math.min(n, step | 0 || 1));

// the finds spread over the scan's window: a cell each of an 8 by 3 grid, a little off its middle
function scatter(t, counts) {
  const cells = t.shuffle(Array.from({ length: 24 }, (_, i) => i)), out = [];
  let k = 0;
  for (const [kind, n] of counts) for (let i = 0; i < n; i++) {
    const c = cells[k++];
    out.push({ kind, x: ((c % 8) + 0.5 + (t.int(-25, 25) / 100)) / 8, y: (Math.floor(c / 8) + 0.5 + (t.int(-20, 20) / 100)) / 3 });
  }
  return out;
}
const tally = (items, kind) => items.filter((i) => i.kind === kind).length;

// wrong answers by number: the ones not right, not repeated, above nothing (engine.js ownOrder drops a 0)
const nums = (right, unit, slips) => slips.filter((s) => Number.isFinite(s[0]) && s[0] > 0 && s[0] !== right).map(([n, slip, why]) => ({ ...C(n, unit), slip, why }));

// ── THE MAKERS ───────────────────────────────────────────────────────────────────────────────────────────────────
export const MAKERS = {
  // ── COUNTING WHAT THE SCAN FOUND ───────────────────────────────────────────────────────────────────────────────
  // step 1  one kind, up to 5: how many?
  // step 2  two or three kinds, up to 10 in all: how many of one kind?
  // step 3  three kinds: which is there most of (or fewest)?
  count: {
    strand: 'number', at: (step) => [0, 4, 8][step3(step, 3) - 1],
    make(step, { rand = Math.random } = {}) {
      const t = kit(rand), P = t.pick(PLACES);
      step = step3(step, 3);
      if (step === 1) {
        const K = t.pick(KIND_LIST), n = t.int(1, 5), items = scatter(t, [[K.key, n]]);
        const pic = scanPic({ items, title: `The scan of ${P.name}`, seed: n + 1 });
        return ownOrder({
          key: 'count:one', story: `The scan of ${P.name} has found some ${K.unit[1]}.`, ask: `How many ${K.unit[1]} are there?`,
          right: C(n, K.unit),
          slips: nums(n, K.unit, [[n + 1, 'twice', 'One was counted twice. Touch each one once as you count.'], [n - 1, 'missed', 'One was missed. Touch each one once as you count.'], [n + 2, 'off', 'Count again, one touch for each.']]),
          rightWhy: `${n} ${n === 1 ? K.unit[0] : K.unit[1]}: ${Array.from({ length: n }, (_, i) => i + 1).join(', ')}`,
          lead: pic, picFirst: true,
          help: { title: 'Count them', svg: pic, line: 'Touch each one once as you count: 1, 2, 3 ...', steps: ['Start at one end', 'Touch each one once as you count'] },
          own: { strand: 'number', at: 0 }, facts: { form: 'one', kind: K.key, items, place: P.key, ans: n },
        }, rand, 3);
      }
      if (step === 2) {
        const kinds = t.shuffle([...KIND_LIST]).slice(0, t.chance(0.5) ? 2 : 3);
        let counts;
        for (let tries = 0; tries < 40; tries++) { counts = kinds.map(() => t.int(1, 5)); if (counts.reduce((a, b) => a + b, 0) <= 10 && new Set(counts).size === counts.length) break; }
        const items = scatter(t, kinds.map((K, i) => [K.key, counts[i]])), K = kinds[0], n = counts[0], all = items.length, other = kinds[1];
        return ownOrder({
          key: 'count:sort', story: `The scan of ${P.name} has found ${list(kinds.map((k) => k.what))}.`, ask: `How many ${K.unit[1]}?`,
          right: C(n, K.unit),
          slips: nums(n, K.unit, [[all, 'all', `That counts everything the scan found. Count only the ${K.what}.`], [counts[1], 'other', `That is the ${other.what}. Count only the ${K.what}.`],
            [n + 1, 'twice', `Count only the ${K.what}, and touch each one once.`], [n - 1, 'missed', `One of the ${K.unit[1]} was missed. Look over the whole scan.`]]),
          rightWhy: `${n} ${n === 1 ? K.unit[0] : K.unit[1]} among the ${all} finds`,
          lead: scanPic({ items, title: `The scan of ${P.name}`, seed: all }),
          help: { title: 'Only one kind', svg: scanPic({ items, dim: K.key, seed: all }), line: `Every kind has its own picture. Look only at the ${K.what} and count them.`, steps: [`Find the ${K.what}`, 'Touch each one once as you count'] },
          own: { strand: 'number', at: 4 }, facts: { form: 'sort', kind: K.key, items, place: P.key, ans: n },
        }, rand, 4);
      }
      // which kind is there most of, or fewest
      let counts;
      for (let tries = 0; tries < 40; tries++) { counts = [t.int(1, 6), t.int(1, 6), t.int(1, 6)]; if (new Set(counts).size === 3 && counts.reduce((a, b) => a + b, 0) <= 13) break; }
      const kinds = KIND_LIST, items = scatter(t, kinds.map((K, i) => [K.key, counts[i]])), most = t.chance(0.65);
      const want = most ? Math.max(...counts) : Math.min(...counts), K = kinds[counts.indexOf(want)];
      return ownOrder({
        key: `count:${most ? 'most' : 'fewest'}`, story: `The scan of ${P.name} has found ice, metal and crystals.`, ask: `Which has the scan found ${most ? 'the most' : 'the fewest'} of?`,
        right: Wd(K.key, K.name),
        slips: kinds.filter((k) => k !== K).map((k) => ({ ...Wd(k.key, k.name), slip: 'compare', why: `There ${counts[kinds.indexOf(k)] === 1 ? 'is' : 'are'} ${u(counts[kinds.indexOf(k)], k.unit)} and ${u(want, K.unit)}: ${want} is ${most ? 'more' : 'fewer'}.` })),
        rightWhy: `${list(kinds.map((k, i) => u(counts[i], k.unit)))}: the ${K.what} ${most ? 'most' : 'fewest'}`,
        lead: scanPic({ items, title: `The scan of ${P.name}`, seed: 7 }),
        help: { title: 'Line them up', svg: kindRows({ items, kinds: kinds.map((k) => k.key) }), line: `Line each kind up in a row. The ${most ? 'longest' : 'shortest'} row has the ${most ? 'most' : 'fewest'}.`, steps: ['Count each kind', `Then see which number is ${most ? 'biggest' : 'smallest'}`] },
        own: { strand: 'number', at: 8 }, facts: { form: most ? 'most' : 'fewest', items, counts: Object.fromEntries(kinds.map((k, i) => [k.key, counts[i]])), ans: K.key },
      }, rand, 3);
    },
  },

  // ── A PICTURE CHART: a row of pictures for each place ─────────────────────────────────────────────────────────
  // step 1  one picture a find: how many at one place; which place had the most (or fewest)
  // step 2  how many more, how many fewer, how many in all at two places
  // step 3  one picture for 2, 5 or 10: how many at a place; how many more
  pict: {
    strand: 'number', at: (step) => [10, 14, 32][step3(step, 3) - 1],
    make(step, { rand = Math.random } = {}) {
      const t = kit(rand), K = t.pick(KIND_LIST);
      step = step3(step, 3);
      const nRows = step === 1 ? 3 : t.int(3, 4), places = t.shuffle([...PLACES]).slice(0, nRows);
      const key = step === 3 ? t.pick([2, 5, 10]) : 1;
      const ns = t.distinct(nRows, 1, step === 3 ? 6 : step === 2 ? 9 : 8);
      const rows = places.map((p, i) => ({ label: p.label, n: ns[i] })), vals = ns.map((n) => n * key);
      const title = `${K.name} found at each place`, pic = (o = {}) => rowsPic({ title, kind: K.key, rows, key, ...o });
      const keyLine = key > 1 ? ` Each picture stands for ${key} ${K.unit[1]}.` : ` Each picture is one ${K.unit[0]}.`;
      const story = `The scan counted the ${K.unit[1]} at ${nRows} places.${keyLine}`;
      const a = t.int(0, nRows - 1);
      if (step === 1 && t.chance(0.3)) {
        const most = t.chance(0.6), v = most ? Math.max(...ns) : Math.min(...ns), i = ns.indexOf(v);
        return ownOrder({
          key: `pict:${most ? 'most' : 'fewest'}`, story, ask: `Which place had the ${most ? 'most' : 'fewest'} ${K.unit[1]}?`,
          right: Wd(places[i].key, places[i].label),
          slips: places.filter((_, j) => j !== i).map((p) => ({ ...Wd(p.key, p.label), slip: 'compare', why: `${p.label} has ${ns[places.indexOf(p)]}. Look for the ${most ? 'longest' : 'shortest'} row.` })),
          rightWhy: `${places[i].label} has ${v}, the ${most ? 'longest' : 'shortest'} row`,
          lead: pic(), help: { title: 'The rows side by side', svg: pic(), line: `The ${most ? 'longest' : 'shortest'} row has the ${most ? 'most' : 'fewest'} pictures.`, steps: ['Look along each row', `Find the ${most ? 'longest' : 'shortest'} one`] },
          own: { strand: 'number', at: 10 }, facts: { form: most ? 'most' : 'fewest', rows, key, kind: K.key, ans: places[i].key },
        }, rand, 3);
      }
      if (step === 1 || (step === 3 && t.chance(0.55))) {
        const n = ns[a], v = vals[a];
        const slips = step === 1
          ? nums(v, K.unit, [[ns[(a + 1) % nRows], 'row', `That is the ${places[(a + 1) % nRows].label} row. Find the row for ${places[a].name}.`], [n + 1, 'twice', 'Count the pictures in that row again, one touch for each.'], [n - 1, 'missed', 'One picture in that row was missed.'],
            [ns[(a + 2) % nRows], 'row', `That is the ${places[(a + 2) % nRows].label} row. Find the row for ${places[a].name}.`], [n + 2, 'off', 'Count the pictures in that row again, one touch for each.']])
          : nums(v, K.unit, [[n, 'pictures', `That counts the pictures. Each one stands for ${key}.`], [v + key, 'one more', `That is one picture too many. Count the pictures in the row, then ${key} for each.`], [v - key, 'one less', `One picture was missed. Count the pictures in the row, then ${key} for each.`], [vals[(a + 1) % nRows], 'row', `That is the ${places[(a + 1) % nRows].label} row.`]]);
        return ownOrder({
          key: `pict:read:${key}`, story, ask: `How many ${K.unit[1]} were found at ${places[a].name}?`,
          right: C(v, K.unit), slips,
          rightWhy: key > 1 ? `${n} pictures, ${key} for each: ${n} × ${key} = ${v}` : `${n} ${n === 1 ? 'picture' : 'pictures'} in the ${places[a].label} row`,
          ...(key > 1 ? { sum: { op: 'mul', a: n, b: key } } : {}),
          lead: pic(),
          help: { title: key > 1 ? `Count by ${key}s` : 'One row', svg: pic({ hi: [a], count: key > 1 ? [String(key), String(2 * key), '...'] : null }), line: key > 1 ? `Count along the ${places[a].label} row by ${key}s: ${key}, ${2 * key}, ...` : `Look only at the ${places[a].label} row, and count its pictures.`, steps: key > 1 ? ['Count the pictures in the row', `Then ${key} for each picture`] : ['Find the row', 'Count its pictures'] },
          own: { strand: key > 1 ? 'mul' : 'number', at: step === 1 ? 10 : 32 }, facts: { form: 'read', rows, key, kind: K.key, ask: a, ans: v },
        }, rand, step === 1 ? 3 : 4);
      }
      // two rows: more, fewer, in all
      let b = (a + 1 + t.int(0, nRows - 2)) % nRows;
      const hiI = ns[a] > ns[b] ? a : b, loI = hiI === a ? b : a, form = step === 3 ? 'more' : t.pick(['more', 'more', 'fewer', 'all']);
      const A = vals[hiI], B = vals[loI], ans = form === 'all' ? A + B : A - B;
      const ask = form === 'more' ? `How many more ${K.unit[1]} were found at ${places[hiI].name} than at ${places[loI].name}?`
        : form === 'fewer' ? `How many fewer ${K.unit[1]} were found at ${places[loI].name} than at ${places[hiI].name}?`
          : `How many ${K.unit[1]} were found at ${places[hiI].name} and ${places[loI].name} together?`;
      const sum = key > 1 ? [{ op: 'mul', a: ns[hiI], b: key, say: `First ${places[hiI].label}` }, { op: 'mul', a: ns[loI], b: key, say: `Then ${places[loI].label}` }, { op: form === 'all' ? 'add' : 'sub', a: A, b: B, say: form === 'all' ? 'Then add them' : 'Then take the smaller away' }]
        : { op: form === 'all' ? 'add' : 'sub', a: A, b: B };
      const slips = form === 'all'
        ? nums(ans, K.unit, [[A - B, 'took away', 'That is how many more. Together means both rows added.'], [A, 'one row', `That is only the ${places[hiI].label} row. Add the ${places[loI].label} row too.`], [ans + 1, 'off', 'Count both rows again.'], [ans - 1, 'off', 'Count both rows again.']])
        : nums(ans, K.unit, [[A + B, 'added', `That adds the two rows. How many ${form === 'more' ? 'more' : 'fewer'}: take the smaller from the bigger.`], [A, 'one row', `That is the whole ${places[hiI].label} row. Take away the ${places[loI].label} row.`], [B, 'other row', `That is the ${places[loI].label} row. Match them up: the ones left over are the answer.`], ...(key > 1 ? [[ns[hiI] - ns[loI], 'pictures', `That counts pictures. Each one stands for ${key}.`]] : [[ans + 1, 'off', 'Match the rows one to one, and count the ones left over.']])]);
      return ownOrder({
        key: `pict:${form}:${key}`, story, ask, right: C(ans, K.unit), slips,
        rightWhy: form === 'all' ? `${A} + ${B} = ${ans}` : `${A} − ${B} = ${ans}`,
        sum,
        lead: pic(),
        help: { title: form === 'all' ? 'Both rows' : 'Match them up', svg: pic({ hi: [hiI, loI], match: form !== 'all' }),
          line: form === 'all' ? `Count the ${places[hiI].label} row, then keep counting along the ${places[loI].label} row.` : `Match each picture in the shorter row with one in the longer row. ${key > 1 ? `The ringed ones are left over: ${key} for each.` : 'The ringed ones are left over.'}`,
          steps: key > 1 ? [`${places[hiI].label}: ${ns[hiI]} pictures, ${key} each`, `${places[loI].label}: ${ns[loI]} pictures, ${key} each`, form === 'all' ? 'Then add them' : 'Then take the smaller from the bigger'] : [form === 'all' ? `${A} and ${B} more` : `${A} take away ${B}`] },
        own: { strand: form === 'all' ? 'add' : 'sub', at: [10, 14, 32][step - 1] }, credit: [{ strand: 'number', at: 10, weight: 0.5 }],
        facts: { form, rows, key, kind: K.key, a: hiI, b: loI, ans }, size: key > 1 ? 2 : 1,
      }, rand);
    },
  },

  // ── A BAR CHART: a bar for each place, the scale up the side ──────────────────────────────────────────────────
  // step 1  counted by 1s, up to 10: how many at a place; which place had the most (fewest)
  // step 2  two bars: how many more, how many fewer, how many in all
  // step 3  the scale counted by 2s, 5s or 10s: how many at a place; how many more
  // step 4  two steps: all four places added; one place against two others together
  bar: {
    strand: 'number', at: (step) => [20, 22, 28, 38][step3(step, 4) - 1],
    make(step, { rand = Math.random } = {}) {
      const t = kit(rand), K = t.pick(KIND_LIST);
      step = step3(step, 4);
      const st = step >= 3 ? t.pick([2, 5, 10]) : 1, n = step === 4 ? 4 : t.int(3, 4), places = t.shuffle([...PLACES]).slice(0, n);
      let vs = t.distinct(n, 1, 10).map((k) => k * st);
      if (step === 4 && t.chance(0.5)) {
        // one place against two others together: the first the biggest, more than the other two added
        for (let tries = 0; tries < 60; tries++) { vs = t.distinct(n, 1, 10).map((k) => k * st); const [x, y, z] = vs; if (x > y + z) break; }
      }
      const top = 10 * st, bars = places.map((p, i) => ({ label: p.label, v: vs[i] })), unit = K.unit;
      const title = `${K.name} found at each place`, chart = (o = {}) => barPic({ title, unit: K.unit[1], bars, step: st, top, kind: K.key, ...o });
      const story = `The scan counted the ${unit[1]} at ${n} places.${st > 1 ? ` The lines go up by ${st}s.` : ''}`;
      const a = t.int(0, n - 1);
      if (step === 4) {
        const [x, y, z] = vs, vsTwo = x > y + z;
        if (vsTwo) {
          const ans = x - (y + z);
          return ownOrder({
            key: 'bar:vsTwo', story, ask: `How many more ${unit[1]} were found at ${places[0].name} than at ${places[1].name} and ${places[2].name} together?`,
            right: C(ans, unit),
            slips: nums(ans, unit, [[x - y, 'one', `That takes away only ${places[1].label}. Add ${places[1].label} and ${places[2].label} first.`], [x - z, 'one', `That takes away only ${places[2].label}. Add ${places[1].label} and ${places[2].label} first.`], [y + z, 'together', `That is ${places[1].label} and ${places[2].label} together. Now take that from ${places[0].label}.`], [x + y + z, 'all', 'That adds all three. How many more: take the two together away.']]),
            rightWhy: `${y} + ${z} = ${y + z}; ${x} − ${y + z} = ${ans}`,
            sum: [{ op: 'add', a: y, b: z, say: `First ${places[1].label} and ${places[2].label} together` }, { op: 'sub', a: x, b: y + z, say: `Then take that from ${places[0].label}` }],
            lead: chart(), help: { title: 'Two steps', svg: chart({ hi: [0, 1, 2], dash: [0, 1, 2] }), line: `First add ${places[1].label} and ${places[2].label}. Then see how much more ${places[0].label} is than that.`, steps: [`${places[1].label} and ${places[2].label} together: ${y} + ${z}`, `Then ${places[0].label} take away that`] },
            own: { strand: 'words', at: 38 }, credit: [{ strand: 'add', at: 30, weight: 0.5 }], facts: { form: 'vsTwo', bars, step: st, kind: K.key, ans }, size: 2,
          }, rand);
        }
        const ans = vs.reduce((s, v) => s + v, 0);
        return ownOrder({
          key: 'bar:all4', story, ask: `How many ${unit[1]} were found at all ${n} places together?`,
          right: C(ans, unit),
          slips: nums(ans, unit, [[ans - vs[3], 'three', `That leaves out ${places[3].label}. Add all ${n} bars.`], [Math.max(...vs), 'biggest', 'That is only the tallest bar. Add all of them.'], [ans + st, 'off', `Read each bar again: the lines go up by ${st}s.`], [vs.reduce((s, v) => s + v / st, 0), 'lines', `That counts the lines, not what they stand for: each line is ${st}.`]]),
          rightWhy: `${vs.join(' + ')} = ${ans}`,
          sum: [{ op: 'add', a: vs[0], b: vs[1], say: `${places[0].label} and ${places[1].label}` }, { op: 'add', a: vs[0] + vs[1], b: vs[2], say: `and ${places[2].label}` }, { op: 'add', a: vs[0] + vs[1] + vs[2], b: vs[3], say: `and ${places[3].label}` }],
          lead: chart(), help: { title: 'Bar by bar', svg: chart({ dash: [0, 1, 2, 3] }), line: `Read each bar across to the scale (it goes up by ${st}s), then add them one at a time.`, steps: places.map((p) => `${p.label}: read its bar`).concat(['Then add them']) },
          own: { strand: 'add', at: 38 }, credit: [{ strand: 'number', at: 20, weight: 0.5 }], facts: { form: 'all4', bars, step: st, kind: K.key, ans }, size: 3,
        }, rand);
      }
      if (step === 1 && t.chance(0.3)) {
        const most = t.chance(0.6), v = most ? Math.max(...vs) : Math.min(...vs), i = vs.indexOf(v);
        return ownOrder({
          key: `bar:${most ? 'most' : 'fewest'}`, story, ask: `Which place had the ${most ? 'most' : 'fewest'} ${unit[1]}?`,
          right: Wd(places[i].key, places[i].label),
          slips: places.filter((_, j) => j !== i).map((p) => ({ ...Wd(p.key, p.label), slip: 'compare', why: `The ${p.label} bar is not the ${most ? 'tallest' : 'shortest'}.` })),
          rightWhy: `The ${places[i].label} bar is the ${most ? 'tallest' : 'shortest'}: ${v}`,
          lead: chart(), help: { title: 'Tall and short', svg: chart(), line: `The ${most ? 'tallest' : 'shortest'} bar is the place with the ${most ? 'most' : 'fewest'}.`, steps: [`Find the ${most ? 'tallest' : 'shortest'} bar`, 'Read its name under it'] },
          own: { strand: 'number', at: 20 }, facts: { form: most ? 'most' : 'fewest', bars, step: st, kind: K.key, ans: places[i].key },
        }, rand, n >= 4 ? 4 : 3);
      }
      if (step === 1 || (step === 3 && t.chance(0.5))) {
        const v = vs[a], b = (a + 1) % n;
        return ownOrder({
          key: `bar:read:${st}`, story, ask: `How many ${unit[1]} were found at ${places[a].name}?`,
          right: C(v, unit),
          slips: nums(v, unit, [[v + st, 'line up', `Run your finger straight across from the top of the ${places[a].label} bar to the scale. That is the line above it.`], [v - st, 'line down', `Run your finger straight across from the top of the ${places[a].label} bar to the scale. That is the line below it.`], [vs[b], 'bar', `That is the ${places[b].label} bar. Find the bar for ${places[a].name}.`], ...(st > 1 ? [[v / st, 'lines', `That counts the lines. They go up by ${st}s.`]] : []),
            [vs[(a + 2) % n], 'bar', `That is the ${places[(a + 2) % n].label} bar. Find the bar for ${places[a].name}.`], [v + 2 * st, 'off', `Run your finger straight across from the top of the ${places[a].label} bar to the scale.`]]),
          rightWhy: `The top of the ${places[a].label} bar is level with ${v}`,
          lead: chart(), help: { title: 'Straight across', svg: chart({ hi: [a], dash: [a] }), line: `Run your finger from the top of the ${places[a].label} bar straight across to the scale.${st > 1 ? ` The lines go up by ${st}s: count ${st}, ${2 * st}, ...` : ''}`, steps: [`Find the ${places[a].label} bar`, 'Go straight across from its top to the numbers'] },
          own: { strand: 'number', at: step === 1 ? 20 : 28 }, facts: { form: 'read', bars, step: st, kind: K.key, ask: a, ans: v },
        }, rand, step === 1 ? 3 : 4);
      }
      // two bars: more, fewer, in all
      const b = (a + 1 + t.int(0, n - 2)) % n, hiI = vs[a] > vs[b] ? a : b, loI = hiI === a ? b : a;
      const form = step === 3 ? 'more' : t.pick(['more', 'more', 'fewer', 'all']), A = vs[hiI], B = vs[loI], ans = form === 'all' ? A + B : A - B;
      const ask = form === 'more' ? `How many more ${unit[1]} were found at ${places[hiI].name} than at ${places[loI].name}?`
        : form === 'fewer' ? `How many fewer ${unit[1]} were found at ${places[loI].name} than at ${places[hiI].name}?`
          : `How many ${unit[1]} were found at ${places[hiI].name} and ${places[loI].name} together?`;
      const slips = form === 'all'
        ? nums(ans, unit, [[A - B, 'took away', 'That is how many more. Together means the two bars added.'], [A, 'one bar', `That is only the ${places[hiI].label} bar. Add the ${places[loI].label} bar too.`], [ans + st, 'off', 'Read both bars again, straight across to the scale.'], [ans - st, 'off', 'Read both bars again, straight across to the scale.']])
        : nums(ans, unit, [[A + B, 'added', `That adds the two bars. How many ${form === 'more' ? 'more' : 'fewer'}: take the smaller from the bigger.`], [A, 'one bar', `That is the whole ${places[hiI].label} bar. Take away the ${places[loI].label} bar.`], [B, 'other bar', `That is the ${places[loI].label} bar. The answer is the gap between the two tops.`], [ans + st, 'off', 'Read both bars again, straight across to the scale.']]);
      return ownOrder({
        key: `bar:${form}:${st}`, story, ask, right: C(ans, unit), slips,
        rightWhy: form === 'all' ? `${A} + ${B} = ${ans}` : `${A} − ${B} = ${ans}`,
        sum: { op: form === 'all' ? 'add' : 'sub', a: A, b: B },
        lead: chart(),
        help: { title: form === 'all' ? 'Both bars' : 'The gap between the tops', svg: chart(form === 'all' ? { hi: [hiI, loI], dash: [hiI, loI] } : { hi: [hiI, loI], bracket: [hiI, loI] }), line: form === 'all' ? `Read each bar across to the scale, then add them.` : `Read each bar across to the scale. How many more is the gap between the two tops: the bigger take away the smaller.`, steps: [`${places[hiI].label}: read its bar`, `${places[loI].label}: read its bar`, form === 'all' ? 'Then add them' : 'Then take the smaller from the bigger'] },
        own: { strand: form === 'all' ? 'add' : 'sub', at: step === 2 ? 22 : 28 }, credit: [{ strand: 'number', at: 20, weight: 0.5 }],
        facts: { form, bars, step: st, kind: K.key, a: hiI, b: loI, ans }, size: 2,
      }, rand);
    },
  },

  // ── A LINE PLOT: a dot for each crystal the probe measured, over its length ───────────────────────────────────
  // step 1  how many were so long; which length came up most often; how many were measured in all
  // step 2  how many were longer than a length; how much longer the longest is than the shortest
  dots: {
    strand: 'number', at: (step) => [34, 40][step3(step, 2) - 1],
    make(step, { rand = Math.random } = {}) {
      const t = kit(rand), lo = t.int(1, 4), hi = lo + t.int(5, 7), UNIT = ['crystal', 'crystals'], CM = ['centimetre', 'centimetres'];
      step = step3(step, 2);
      let counts = {};
      for (let tries = 0; tries < 80; tries++) {
        counts = {};
        const n = t.int(8, 13);
        for (let i = 0; i < n; i++) { const v = t.int(lo + 1, hi - 1); counts[v] = (counts[v] || 0) + 1; }
        const c = Object.values(counts), top = Math.max(...c);
        if (top <= 5 && c.filter((x) => x === top).length === 1 && Object.keys(counts).length >= 4) break;
      }
      const lengths = Object.keys(counts).map(Number).sort((a, b) => a - b), total = Object.values(counts).reduce((a, b) => a + b, 0);
      const title = 'Crystals measured by the probe', pic = (o = {}) => dotsPic({ title, unit: 'length in centimetres', lo, hi, counts, ...o });
      const story = `The probe measured the crystals it found. Each dot is one crystal, over its length.`;
      if (step === 1) {
        const form = t.pick(['how many', 'how many', 'most', 'all']);
        if (form === 'most') {
          const top = Math.max(...Object.values(counts)), L = lengths.find((v) => counts[v] === top);
          const others = t.shuffle(lengths.filter((v) => v !== L)).slice(0, 3);
          return ownOrder({
            key: 'dots:most', story, ask: 'Which length came up most often?',
            right: C(L, CM), slips: others.map((v) => ({ ...C(v, CM), slip: 'fewer', why: `${v} cm has ${counts[v]} ${counts[v] === 1 ? 'dot' : 'dots'}. Look for the tallest stack.` })),
            rightWhy: `${L} cm has the most dots: ${top}`,
            lead: pic(), help: { title: 'The tallest stack', svg: pic(), line: 'The length that came up most often has the tallest stack of dots.', steps: ['Find the tallest stack', 'Read the length under it'] },
            own: { strand: 'number', at: 34 }, facts: { form, counts, lo, hi, ans: L },
          }, rand);
        }
        if (form === 'all') {
          return ownOrder({
            key: 'dots:all', story, ask: 'How many crystals did the probe measure?',
            right: C(total, UNIT), slips: nums(total, UNIT, [[lengths.length, 'stacks', 'That counts the stacks. Count every dot.'], [hi - lo + 1, 'lengths', 'That counts the lengths on the line. Count the dots.'], [total + 1, 'off', 'Count every dot once.'], [total - 1, 'off', 'One dot was missed.']]),
            rightWhy: `${lengths.map((v) => counts[v]).join(' + ')} = ${total} dots`,
            lead: pic(), help: { title: 'Every dot', svg: pic(), line: 'Each dot is one crystal. Count every dot in every stack.', steps: ['Count the dots in each stack', 'Then add the stacks'] },
            own: { strand: 'number', at: 34 }, credit: [{ strand: 'add', at: 20, weight: 0.5 }], facts: { form, counts, lo, hi, ans: total },
          }, rand);
        }
        const L = t.pick(lengths), n = counts[L], next = lengths.find((v) => v !== L && counts[v] !== n);
        return ownOrder({
          key: 'dots:count', story, ask: `How many crystals were ${L} centimetres long?`,
          right: C(n, UNIT), slips: nums(n, UNIT, [[next ? counts[next] : n + 2, 'stack', `That is the stack over ${next} cm. Find ${L} on the line.`], [L, 'length', `${L} is the length. Count the dots over it.`], [n + 1, 'off', `Count the dots over ${L} again.`], [n - 1 || n + 2, 'off', `Count the dots over ${L} again.`]]),
          rightWhy: `${n} ${n === 1 ? 'dot' : 'dots'} over ${L} cm`,
          lead: pic(), help: { title: 'One stack', svg: pic({ lit: [L] }), line: `Find ${L} on the line. Each dot over it is one crystal ${L} cm long.`, steps: [`Find ${L} on the line`, 'Count the dots over it'] },
          own: { strand: 'number', at: 34 }, facts: { form: 'count', counts, lo, hi, at: L, ans: n },
        }, rand);
      }
      if (t.chance(0.55)) {
        const L = lengths[t.int(1, lengths.length - 2)], over = lengths.filter((v) => v > L).reduce((s, v) => s + counts[v], 0), atL = counts[L];
        return ownOrder({
          key: 'dots:over', story, ask: `How many crystals were longer than ${L} centimetres?`,
          right: C(over, UNIT), slips: nums(over, UNIT, [[over + atL, 'and L', `That counts the ${L} cm ones too. Longer than ${L} starts after ${L}.`], [total - over - atL, 'shorter', `Those are the shorter ones. Count the dots to the right of ${L}.`], [lengths.filter((v) => v > L).length, 'stacks', 'That counts the stacks. Count every dot in them.'], [over + 1, 'off', `Count the dots to the right of ${L} again.`]]),
          rightWhy: lengths.filter((v) => v > L).map((v) => `${counts[v]} at ${v} cm`).join(', ') + `: ${over}`,
          sum: (() => { const xs = lengths.filter((v) => v > L).map((v) => counts[v]); if (xs.length < 2) return null; const ch = []; let acc = xs[0]; for (let i = 1; i < xs.length; i++) { ch.push({ op: 'add', a: acc, b: xs[i] }); acc += xs[i]; } return ch; })(),
          lead: pic(), help: { title: 'To the right', svg: pic({ lit: lengths.filter((v) => v > L) }), line: `Longer than ${L} cm is every stack to the right of ${L}, not ${L} itself. Add those stacks.`, steps: [`The stacks after ${L}`, 'Add their dots'] },
          own: { strand: 'add', at: 40 }, credit: [{ strand: 'number', at: 34, weight: 0.5 }], facts: { form: 'over', counts, lo, hi, at: L, ans: over }, size: 2,
        }, rand);
      }
      const mx = lengths[lengths.length - 1], mn = lengths[0], d = mx - mn;
      return ownOrder({
        key: 'dots:spread', story, ask: 'How much longer is the longest crystal than the shortest?',
        right: C(d, CM), slips: nums(d, CM, [[mx, 'longest', `${mx} cm is the longest. Take the shortest away.`], [hi - lo, 'line', 'That is the whole line, from end to end. Use the dots at each end.'], [mx + mn, 'added', 'That adds them. How much longer: take the shortest from the longest.'], [d + 1, 'counted', 'That counts the marks from one to the other. Count the gaps between them.']]),
        rightWhy: `${mx} − ${mn} = ${d} cm`,
        sum: { op: 'sub', a: mx, b: mn },
        lead: pic(), help: { title: 'End to end', svg: pic({ lit: [mn, mx] }), line: 'The shortest crystal is the dot furthest left, the longest the dot furthest right. Take the shortest from the longest.', steps: ['The longest: the furthest right', 'The shortest: the furthest left', 'Then the longest take away the shortest'] },
        own: { strand: 'sub', at: 40 }, credit: [{ strand: 'number', at: 34, weight: 0.5 }], facts: { form: 'spread', counts, lo, hi, ans: d }, size: 2,
      }, rand);
    },
  },

  // ── A LINE GRAPH: the ground's warmth through the day ─────────────────────────────────────────────────────────
  // step 1  when was it warmest (coldest); how much warmer at one time than at another
  line: {
    strand: 'number', at: () => 48,
    make(step, { rand = Math.random } = {}) {
      const t = kit(rand), P = t.pick(PLACES), DEG = ['degree', 'degrees'];
      let vs;
      for (let tries = 0; tries < 60; tries++) {
        const peak = t.int(2, 4); vs = TIMES.map((_, i) => Math.max(1, Math.min(6, 6 - Math.abs(i - peak) - t.int(0, 1) + t.int(0, 1))) * 5);
        const mx = Math.max(...vs), mn = Math.min(...vs);
        if (vs.filter((v) => v === mx).length === 1 && vs.filter((v) => v === mn).length === 1 && mx - mn >= 10) break;
        vs = null;
      }
      if (!vs) vs = [10, 15, 25, 30, 20, 5];
      const points = TIMES.map((label, i) => ({ label, v: vs[i] }));
      const graph = (o = {}) => linePic({ title: `The warmth of ${P.name}, every hour`, unit: '°C', points, step: 5, top: 30, ...o });
      const story = `A probe at ${P.name} read the ground's warmth every hour.`;
      if (t.chance(0.45)) {
        const warm = t.chance(0.6), v = warm ? Math.max(...vs) : Math.min(...vs), i = vs.indexOf(v);
        const others = t.shuffle(TIMES.map((_, j) => j).filter((j) => j !== i)).slice(0, 3);
        return ownOrder({
          key: `line:${warm ? 'warmest' : 'coldest'}`, story, ask: `At what time was it ${warm ? 'warmest' : 'coldest'}?`,
          right: Wd(TIMES[i], TIMES[i]),
          slips: others.map((j) => ({ ...Wd(TIMES[j], TIMES[j]), slip: 'point', why: `At ${TIMES[j]} it was ${vs[j]} °C. Look for the ${warm ? 'highest' : 'lowest'} point of the line.` })),
          rightWhy: `${TIMES[i]}: ${v} °C, the ${warm ? 'highest' : 'lowest'} point`,
          lead: graph(), help: { title: warm ? 'The highest point' : 'The lowest point', svg: graph(), line: `The warmer it is, the higher the line. Find its ${warm ? 'highest' : 'lowest'} point and read the time under it.`, steps: [`Find the ${warm ? 'highest' : 'lowest'} point`, 'Read the time under it'] },
          own: { strand: 'number', at: 48 }, facts: { form: warm ? 'warmest' : 'coldest', points, ans: TIMES[i] },
        }, rand);
      }
      let i, j;
      for (let tries = 0; tries < 40; tries++) { i = t.int(0, 5); j = t.int(0, 5); if (vs[j] > vs[i]) break; }
      if (!(vs[j] > vs[i])) { i = vs.indexOf(Math.min(...vs)); j = vs.indexOf(Math.max(...vs)); }
      const d = vs[j] - vs[i];
      return ownOrder({
        key: 'line:warmer', story, ask: `How much warmer was it at ${TIMES[j]} than at ${TIMES[i]}?`,
        right: C(d, DEG), slips: nums(d, DEG, [[vs[j], 'one', `${vs[j]} °C is the warmth at ${TIMES[j]}. Take away the warmth at ${TIMES[i]}.`], [vs[i] + vs[j], 'added', 'That adds them. How much warmer: take the smaller from the bigger.'], [d + 5, 'line', 'Read both points again, straight across to the scale: it goes up by 5s.'], [Math.abs(j - i), 'hours', 'That is the hours between them. The warmth is up the side.']]),
        rightWhy: `${vs[j]} − ${vs[i]} = ${d} degrees`,
        sum: { op: 'sub', a: vs[j], b: vs[i] },
        lead: graph(), help: { title: 'Two points', svg: graph({ hi: [i, j] }), line: `Read the warmth at ${TIMES[i]} and at ${TIMES[j]} straight across to the scale, then take the smaller from the bigger.`, steps: [`At ${TIMES[j]}: read across`, `At ${TIMES[i]}: read across`, 'Then take the smaller from the bigger'] },
        own: { strand: 'sub', at: 48 }, credit: [{ strand: 'number', at: 30, weight: 0.5 }], facts: { form: 'warmer', points, a: i, b: j, ans: d }, size: 2,
      }, rand);
    },
  },

  // ── POINTS ON THE MAP (Mathwood Valley's graph ladder on the survey's map of the land below) ───────────────────
  // step 1  the upper right quarter, 0 to 6, the Explorer in the corner: tap the spot, or read a point
  // step 2  the whole map, -5 to 5, the Explorer in the middle: the same, with negatives
  // step 3  two points in a line across (or up) the map: how far apart, over 0
  map: {
    strand: 'geo', at: (step) => [50, 62, 64][step3(step, 3) - 1],
    make(step, { rand = Math.random } = {}) {
      const t = kit(rand), K = t.pick(KIND_LIST), seed = t.int(1, 40);
      step = step3(step, 3);
      if (step === 3) {
        const UNIT = ['unit', 'units'], across = t.chance(0.6), a = -t.int(1, 5), b = t.int(1, 5), c = t.int(-4, 4) || 2, d = b - a;
        const P = across ? [[a, c], [b, c]] : [[c, a], [c, b]], said = (p) => pointText(p[0], p[1]);
        const map = { hi: 6, quad: 4, size: 300 };
        return ownOrder({
          key: `map:apart:${across ? 'across' : 'up'}`, story: `A probe has landed at ${said(P[0])}. The scan has found ${K.what} at ${said(P[1])}. The probe rolls straight ${across ? 'across' : 'up'} the map to it.`,
          ask: 'How many units does it roll?', right: C(d, UNIT),
          slips: nums(d, UNIT, [[Math.abs(b + a), 'signs', `${numText(a)} is on the other side of 0. Count from ${numText(a)} up to 0, then on to ${b}.`], [b, 'from zero', `That is from 0 to ${b}. The probe starts on the other side of 0.`], [-a, 'to zero', `That is only as far as 0. Keep going to ${b}.`], [d + 1, 'lines', 'That counts the lines it crosses, both ends too. Count the gaps between them.']]),
          rightWhy: `From ${numText(a)} to 0 is ${-a}, and on to ${b} is ${b} more: ${-a} + ${b} = ${d} units`,
          sum: { op: 'add', a: -a, b },
          lead: landMap(map, { points: [{ x: P[0][0], y: P[0][1], kind: 'probe', label: 'probe' }, { x: P[1][0], y: P[1][1], kind: K.key }], path: P, seed }),
          help: { title: 'Over 0', svg: numberLine({ a, b, label: across ? 'across' : 'up' }), line: `One end is below 0, the other above it. Count the units from ${numText(a)} up to 0, then on from 0 to ${b}.`, steps: [`From ${numText(a)} to 0`, `From 0 to ${b}`, 'Then add the two'] },
          own: { strand: 'geo', at: 64 }, credit: [{ strand: 'add', at: 60, weight: 0.5 }], facts: { form: 'apart', across, from: P[0], to: P[1], ans: d }, size: 2,
        }, rand);
      }
      const whole = step === 2, gen = whole ? { lo: -5, hi: 5 } : { lo: 0, hi: 6 }, map = { hi: whole ? 5 : 6, quad: whole ? 4 : 1, size: 300 };
      const { x, y } = pickPoint(gen, rand), here = pointText(x, y), from = 'the Explorer, over (0, 0)';
      if (t.chance(0.5)) {
        // tap it: the right crossing, the crossings a slip lands on (each with its line why), and any other crossing
        const F = (p) => ({ v: pointText(p.x, p.y), big: pointText(p.x, p.y), small: '', label: `the spot ${pointText(p.x, p.y)}` });
        const near = choicesFor(x, y, gen, rand).filter((c) => !c.good);
        const o = ownOrder({
          key: `map:tap:${whole ? 'whole' : 'quarter'}`, story: `The scan has found ${K.what} at ${here}. The Explorer is over (0, 0).`, ask: 'Tap that spot on the map.',
          right: F({ x, y }),
          slips: [...near.map((p) => ({ ...F(p), slip: p.x === y && p.y === x ? 'swapped' : 'near', why: `That spot is ${pointText(p.x, p.y)}. For ${here}, start at 0: ${walkWords(x, y)}.` })), { v: 'else', big: 'another spot', small: '', label: 'another spot', slip: 'else', why: '' }],
          rightWhy: `${here}: ${walkWords(x, y)}`,
          help: { title: 'Across, then up', svg: landMap(map, { seed, path: [[0, 0], [x, 0]], ask: `${here}: ${walk1(x)}, then ?` }), line: `Start at ${from}. The first number is how far across${whole ? ' (minus: to the left)' : ''}; the second is how far up${whole ? ' (minus: down)' : ''}.`, steps: [`Across: ${numText(x)}`, `Then up: ${numText(y)}`] },
          own: { strand: 'geo', at: whole ? 62 : 50 }, facts: { form: 'tap', x, y, whole, kind: K.key }, size: 1,
          tap: { map, at: [x, y] },
        }, rand, 8);
        o.tap.judge = (gx, gy) => mapJudge(o, gx, gy);
        o.tap.draw = (marks) => landMap(map, { seed, marks: marks.map((m) => ({ ...m, find: K.key })) });
        return o;
      }
      // read it off the map: Mathwood's four answers (the point, x and y swapped, a sign turned, one off)
      const ch = choicesFor(x, y, gen, rand), T = (p) => ({ v: pointText(p.x, p.y), big: pointText(p.x, p.y), small: '', label: pointText(p.x, p.y) });
      return ownOrder({
        key: `map:read:${whole ? 'whole' : 'quarter'}`, story: `The scan has marked ${K.what} on the map. The Explorer is over (0, 0).`, ask: 'Where on the map is it?',
        right: T({ x, y }),
        slips: ch.filter((c) => !c.good).map((p) => ({ ...T(p), slip: p.x === y && p.y === x ? 'swapped' : 'near', why: `${pointText(p.x, p.y)} would be ${walkWords(p.x, p.y)}. Count across first, then up.` })),
        rightWhy: `${walkWords(x, y)}: ${here}`,
        lead: landMap(map, { points: [{ x, y, kind: K.key }], seed }),
        help: { title: 'Across, then up', svg: landMap(map, { points: [{ x, y, kind: K.key }], seed, ask: 'across first, then up: (?, ?)' }), line: `Start at ${from}. Count the lines across to under the ${K.what}${whole ? ' (to the left is minus)' : ''}: that is the first number. Then count up${whole ? ' (down is minus)' : ''}: the second.`, steps: ['First how far across', 'Then how far up'] },
        own: { strand: 'geo', at: whole ? 62 : 52 }, facts: { form: 'read', x, y, whole, kind: K.key }, size: 1,
      }, rand);
    },
  },

  // ── AVERAGES ─────────────────────────────────────────────────────────────────────────────────────────────────
  // step 1  the average of 3 to 5 readings
  // step 2  a missing reading, from the average and the others
  // step 3  the middle (median), the most common (mode), the spread (range) of 5 or 7 readings
  mean: {
    strand: 'div', at: (step) => [58, 66, 63][step3(step, 3) - 1],
    make(step, { rand = Math.random } = {}) {
      const t = kit(rand), rd = t.pick(READINGS), P = t.pick(PLACES), U = rd.unit;
      step = step3(step, 3);
      const unitWord = U[0] === '°C' ? '°C' : U[1];
      if (step === 3) {
        let vs, med, mode, range, form = t.pick(['median', 'mode', 'range']);
        for (let tries = 0; tries < 200; tries++) {
          const n = t.pick([5, 7]);
          vs = Array.from({ length: n - 1 }, () => t.int(rd.lo, rd.hi));
          vs.push(vs[t.int(0, n - 2)]);
          const s = [...vs].sort((a, b) => a - b), counts = {};
          for (const v of vs) counts[v] = (counts[v] || 0) + 1;
          const top = Math.max(...Object.values(counts)), modes = Object.keys(counts).filter((k) => counts[k] === top);
          med = s[(n - 1) / 2]; mode = +modes[0]; range = s[n - 1] - s[0];
          const asWritten = vs[(n - 1) / 2];
          if (modes.length === 1 && top === 2 && new Set([med, mode, range]).size === 3 && range > 0 && asWritten !== med) break;
        }
        if (!(med !== mode && med !== range && mode !== range && range > 0)) { const L = rd.lo; vs = [L, L, L + 3, L + 5, L + 10]; med = L + 3; mode = L; range = 10; }
        vs = t.shuffle(vs);
        // (keep the middle of the list as written different from the median: the slip of not putting them in order)
        for (let k = 0; k < 20 && vs[(vs.length - 1) / 2] === med; k++) vs = t.shuffle(vs);
        const n = vs.length, s = [...vs].sort((a, b) => a - b), asWritten = vs[(n - 1) / 2], mean = vs.reduce((a, b) => a + b, 0) / n;
        const ans = form === 'median' ? med : form === 'mode' ? mode : range;
        const word = { median: 'the middle reading, the median', mode: 'the reading that came up most often, the mode', range: 'the spread from the lowest reading to the highest, the range' }[form];
        const others = [
          [med, 'median', `${reading(med, rd)} is the middle one once they are in order: the median.`],
          [mode, 'mode', `${reading(mode, rd)} is the one that came up twice: the mode.`],
          [range, 'range', `${range} is the highest take away the lowest: the range.`],
          [asWritten, 'unsorted', 'That is the middle of the list as it is written. Put them in order first, smallest to biggest.'],
          [Number.isInteger(mean) ? mean : null, 'mean', 'That is the average, all of them added and shared out.'],
          [s[n - 1], 'highest', 'That is the highest reading.'],
        ].filter(([v, slip]) => v != null && v !== ans && slip !== form);
        return ownOrder({
          key: `mean:${form}`, story: `A probe at ${P.name} took ${n} readings of ${rd.of}: ${list(vs.map(String))}${U[0] === '°C' ? ' °C' : ` ${U[1]}`}.`,
          ask: `What is ${word}?`,
          right: R(ans, rd), slips: others.filter(([v]) => v > 0).map(([v, slip, why]) => ({ ...R(v, rd), slip, why })),
          rightWhy: form === 'median' ? `In order: ${s.join(', ')}. The middle one is ${med}` : form === 'mode' ? `${mode} comes up twice; every other reading once` : `${s[n - 1]} − ${s[0]} = ${range}`,
          ...(form === 'range' ? { sum: { op: 'sub', a: s[n - 1], b: s[0] } } : {}),
          lead: readingsPic({ title: `${rd.title} at ${P.name}`, unit: unitWord, values: vs }),
          help: { title: { median: 'In order', mode: 'Twice', range: 'Lowest to highest' }[form], svg: readingsPic({ title: `${rd.title} at ${P.name}`, unit: unitWord, values: vs }),
            line: { median: `Put the ${n} readings in order, smallest first. The median is the one in the middle, with ${(n - 1) / 2} on each side.`, mode: 'The mode is the reading that comes up more often than any other. Look for two the same.', range: 'The range is how far apart the lowest and the highest readings are: the highest take away the lowest.' }[form],
            steps: { median: ['Put them in order, smallest first', 'Find the one in the middle'], mode: ['Look for a reading that comes up twice'], range: ['Find the highest and the lowest', 'Then the highest take away the lowest'] }[form] },
          own: { strand: form === 'range' ? 'sub' : 'number', at: 63 }, facts: { form, values: vs, ans }, size: form === 'median' ? 2 : 1,
        }, rand);
      }
      // the average (step 1) or a missing reading (step 2): whole numbers throughout
      let n, vs, m;
      for (let tries = 0; tries < 200; tries++) {
        n = step === 1 ? t.int(3, 5) : t.int(3, 5); m = t.int(rd.lo + 2, rd.hi - 2);
        vs = Array.from({ length: n - 1 }, () => t.int(rd.lo, rd.hi));
        const last = m * n - vs.reduce((a, b) => a + b, 0);
        if (last >= rd.lo && last <= rd.hi && !vs.includes(last)) { vs.push(last); if (new Set(vs).size >= n - 1) break; }
      }
      if (vs.length !== n) { n = 3; m = rd.lo + 4; vs = [m - 2, m, m + 2]; }
      vs = t.shuffle(vs);
      const total = vs.reduce((a, b) => a + b, 0);
      const chain = vs.slice(1).map((v, i) => ({ op: 'add', a: vs.slice(0, i + 1).reduce((a, b) => a + b, 0), b: v, say: i === 0 ? 'First add the readings' : 'and the next' }));
      if (step === 1) {
        const s = [...vs].sort((a, b) => a - b), mid = n % 2 ? s[(n - 1) / 2] : null;
        return ownOrder({
          key: 'mean:average', story: `A probe at ${P.name} took ${n} readings of ${rd.of}: ${list(vs.map(String))}${U[0] === '°C' ? ' °C' : ` ${U[1]}`}.`,
          ask: 'What is the average reading?',
          right: R(m, rd),
          slips: [[total, 'total', `${total} is all of them added. Share the total out over the ${n} readings.`], [mid !== m ? mid : null, 'median', 'That is the middle reading. The average is the total shared out evenly.'],
            [Math.max(...vs), 'highest', 'That is the highest reading. The average is in between the lowest and the highest.'], [Number.isInteger(total / (n - 1)) && total / (n - 1) !== m ? total / (n - 1) : m + 1, 'n-1', `Share the total over all ${n} readings.`], [m - 1, 'off', `Check the adding: then share the total over the ${n} readings.`]]
            .filter(([v]) => v != null && v > 0 && v !== m).map(([v, slip, why]) => ({ ...R(v, rd), slip, why })),
          rightWhy: `${vs.join(' + ')} = ${total}; ${total} ÷ ${n} = ${m}`,
          sum: [...chain, { op: 'div', a: total, b: n, say: `Then share the total out over the ${n} readings` }],
          lead: readingsPic({ title: `${rd.title} at ${P.name}`, unit: unitWord, values: vs }),
          help: { title: 'Level them out', svg: readingsPic({ title: `${rd.title} at ${P.name}`, unit: unitWord, values: vs, avg: m }), line: `The average is what every reading would be if they were all the same: add them all up, then share the total out over the ${n} readings.`, steps: [`Add the ${n} readings`, `Then share the total over ${n}`] },
          own: { strand: 'div', at: 58 }, credit: [{ strand: 'add', at: 30, weight: 0.5 }], facts: { form: 'average', values: vs, ans: m }, size: 2,
        }, rand);
      }
      const miss = t.int(0, n - 1), known = vs.filter((_, i) => i !== miss), x = vs[miss], kt = total - x;
      return ownOrder({
        key: 'mean:missing', story: `A probe at ${P.name} took ${n} readings of ${rd.of}. Their average is ${reading(m, rd)}. ${n - 1} of them were ${list(known.map(String))}${U[0] === '°C' ? ' °C' : ` ${U[1]}`}; the last one was lost.`,
        ask: 'What was the lost reading?',
        right: R(x, rd),
        slips: [[m, 'average', 'That is the average. The lost reading is what makes the average come out right.'], [total, 'total', `${total} is all ${n} readings together. Take away the ${n - 1} you know.`], [kt, 'known', `${kt} is the ${n - 1} readings you know, added. The lost one is what is left of the whole.`],
          [x + m, 'off', `The whole is ${n} × the average. Take the others away from that.`], [x + 1, 'off', 'Check the adding.']]
          .filter(([v]) => v > 0 && v !== x).map(([v, slip, why]) => ({ ...R(v, rd), slip, why })),
        rightWhy: `${n} × ${m} = ${total}; ${known.join(' + ')} = ${kt}; ${total} − ${kt} = ${x}`,
        sum: [{ op: 'mul', a: n, b: m, say: 'First all the readings together' }, ...known.slice(1).map((v, i) => ({ op: 'add', a: known.slice(0, i + 1).reduce((a, b) => a + b, 0), b: v, say: i === 0 ? 'Then the ones you know' : 'and the next' })), { op: 'sub', a: total, b: kt, say: 'Then take those away from the whole' }],
        lead: readingsPic({ title: `${rd.title} at ${P.name}`, unit: unitWord, values: vs, missing: miss }),
        help: { title: 'The whole, then the part', svg: readingsPic({ title: `${rd.title} at ${P.name}`, unit: unitWord, values: vs, missing: miss, avg: m, avgSaid: reading(m, rd) }), line: `If the average is ${m}, all ${n} readings together make ${n} × ${m}. The lost one is that whole, less the ${n - 1} you know.`, steps: [`All ${n} together: ${n} × ${m}`, `The ones you know: add them`, 'Then the whole take away those'] },
        own: { strand: 'div', at: 66 }, credit: [{ strand: 'mul', at: 40, weight: 0.5 }], facts: { form: 'missing', values: vs, missing: miss, average: m, ans: x }, size: 3,
      }, rand);
    },
  },

  // ── CHANCE: a probe drops onto one square of the scan's grid, any one ──────────────────────────────────────────
  // step 1  certain, likely, unlikely or impossible
  // step 2  the chance as a fraction (k of the n squares)
  // step 3  the chance as a percent
  // step 4  about how many of so many probes land on the find
  // step 5  two probes at once, each on its own grid: the chance both land on the find
  chance: {
    strand: 'frac', at: (step) => [44, 70, 72, 74, 78][step3(step, 5) - 1],
    make(step, { rand = Math.random } = {}) {
      const t = kit(rand), K = t.pick(KIND_LIST), P = t.pick(PLACES);
      step = step3(step, 5);
      const grid = (cols, rows, k) => { const cells = t.shuffle(Array.from({ length: cols * rows }, (_, i) => i < k)); return { cols, rows, cells }; };
      const lands = `land on ${K.what}`;
      if (step === 1) {
        const want = t.pick(['certain', 'likely', 'likely', 'unlikely', 'unlikely', 'impossible']), N = 12;
        const k = want === 'certain' ? N : want === 'impossible' ? 0 : want === 'likely' ? t.int(7, 11) : t.int(1, 5);
        const G = grid(4, 3, k), WORDS = { certain: 'Certain', likely: 'Likely', unlikely: 'Unlikely', impossible: 'Impossible' };
        const why = {
          certain: `Certain means every square has ${K.what}. ${k === 0 ? 'None' : `Only ${k}`} of the ${N} ${k === 1 ? 'has' : 'have'} it.`,
          likely: k === 12 ? `Every square has ${K.what}: it can't miss. That is more than likely.` : k === 0 ? `No square has ${K.what}: it can't happen at all.` : `Likely means more than half the squares. ${k} of the ${N} is fewer than half (half is 6).`,
          unlikely: k === 12 ? `Every square has ${K.what}: it can't miss.` : k === 0 ? `No square has ${K.what}: it can't happen at all.` : `Unlikely means fewer than half the squares. ${k} of the ${N} is more than half (half is 6).`,
          impossible: `Impossible means no square has ${K.what}. ${k} of the ${N} ${k === 1 ? 'has' : 'have'} it.`,
        };
        return ownOrder({
          key: 'chance:words', story: `A probe will drop onto one of these ${N} squares of ${P.name}, any one, by chance. The squares with ${K.what} are marked.`, ask: `Will it ${lands}?`,
          right: Wd(want, WORDS[want]),
          slips: Object.keys(WORDS).filter((w) => w !== want).map((w) => ({ ...Wd(w, WORDS[w]), slip: w, why: why[w] })),
          rightWhy: `${k} of the ${N} squares: ${{ certain: 'every one, so it is certain', likely: 'more than half, so it is likely', unlikely: 'fewer than half, so it is unlikely', impossible: 'none, so it is impossible' }[want]}`,
          lead: gridPic({ ...G, kind: K.key, title: `The squares of ${P.name}` }),
          help: { title: 'More or less than half', svg: gridPic({ ...G, kind: K.key, ring: true, half: true }), line: `Count the squares with ${K.what}. All of them: certain. More than half: likely. Fewer than half: unlikely. None: impossible.`, steps: [`Count the squares with ${K.what}`, 'Is that all, more than half, fewer than half, or none?'] },
          own: { strand: 'frac', at: 44 }, facts: { form: 'words', ...G, k, N, ans: want },
        }, rand);
      }
      if (step === 2 || step === 3) {
        const shapes = step === 2 ? [[4, 3], [5, 2], [4, 4], [5, 3], [3, 3], [5, 4]] : [[5, 2], [5, 4], [5, 5]];
        const [cols, rows] = t.pick(shapes), N = cols * rows;
        let k = t.int(1, N - 1);
        if (step === 3) while (k * 2 === N) k = t.int(1, N - 1);
        const G = grid(cols, rows, k), lead = gridPic({ ...G, kind: K.key, title: `The squares of ${P.name}` }), story = `A probe will drop onto one of these ${N} squares of ${P.name}, any one, by chance. ${k} of them ${k === 1 ? 'has' : 'have'} ${K.what}.`;
        if (step === 2) {
          const right = Fr(k, N), seen = new Set([right.val]);
          const slips = [[N - k, N, 'other', `That is the chance of NOT landing on ${K.what}. The squares with ${K.what} go on top.`], [k, N - k, 'odds', `That sets the squares with ${K.what} against the others. A chance is out of all ${N} squares.`], [N, k, 'upside down', 'That is upside down: a chance is never more than 1. The squares with the find go on top, all the squares underneath.'], [k + 1, N, 'off', `Count the squares with ${K.what} again.`], [k, N + 1, 'off', `Count all the squares again: there are ${N}.`]]
            .filter(([a, b]) => a > 0 && b > 0 && !seen.has(a / b) && (seen.add(a / b), true)).map(([a, b, slip, why]) => ({ ...Fr(a, b), slip, why }));
          return ownOrder({
            key: 'chance:fraction', story, ask: `What is the chance it will ${lands}?`, right, slips,
            rightWhy: `${k} squares with ${K.what} out of ${N}: ${k}/${N}`,
            lead, help: { title: 'Out of all of them', svg: gridPic({ ...G, kind: K.key, ring: true }), line: `A chance is a fraction: the squares with ${K.what} on top, all the squares underneath.`, steps: [`On top: the squares with ${K.what}`, 'Underneath: all the squares'] },
            own: { strand: 'frac', at: 70 }, facts: { form: 'fraction', ...G, k, N, ans: right.v },
          }, rand);
        }
        const p = k * 100 / N;
        return ownOrder({
          key: 'chance:percent', story, ask: `What is the chance it will ${lands}, as a percent?`, right: Pc(p),
          slips: [[k, 'count', `${k} is how many squares. As a percent: ${k} out of ${N} is how many out of 100?`], [100 - p, 'other', `That is the chance of NOT landing on ${K.what}.`], [p * 2 <= 100 ? p * 2 : p / 2, 'off', `${k}/${N}: what is it out of 100? ${N} goes into 100 ${100 / N} times.`], [N, 'squares', `${N} is all the squares. Work out ${k} out of ${N} as so many out of 100.`], [p + 100 / N, 'off', 'Count the squares again.']]
            .filter(([v]) => v > 0 && v <= 100 && v !== p && Number.isInteger(v)).map(([v, slip, why]) => ({ ...Pc(v), slip, why })),
          rightWhy: `${k}/${N} = ${k * (100 / N)}/100 = ${p}%`,
          sum: { op: 'mul', a: k, b: 100 / N },
          lead, help: { title: 'Out of 100', svg: gridPic({ ...G, kind: K.key, ring: true }), line: `First the fraction: ${k} out of ${N}. A percent is so many out of 100: ${N} × ${100 / N} = 100, so multiply the top by ${100 / N} too.`, steps: [`The fraction: ${k}/${N}`, `Times ${100 / N} on top and underneath, to make it out of 100`] },
          own: { strand: 'pct', at: 72 }, credit: [{ strand: 'frac', at: 58, weight: 0.5 }], facts: { form: 'percent', ...G, k, N, ans: p }, size: 2,
        }, rand);
      }
      if (step === 4) {
        const PROBES = ['probe', 'probes'];
        let a, b, n;
        for (let tries = 0; tries < 60; tries++) { b = t.pick([2, 3, 4, 5, 10]); a = t.int(1, b - 1); n = t.pick([10, 12, 20, 24, 30, 40, 50, 60]); if (n % b === 0 && n > b && (a > 1 || t.chance(0.3))) break; }
        if (n % b) { b = 4; a = 3; n = 20; }
        const ans = n * a / b, asPct = t.chance(0.35) && 100 % b === 0, said = asPct ? `${a * 100 / b}%` : `${a}/${b}`;
        return ownOrder({
          key: `chance:expect:${asPct ? 'pct' : 'frac'}`, story: `The scan says a probe dropped on ${P.name} has a ${said} chance to ${lands}. The Explorer drops ${n} probes there.`,
          ask: `About how many of them will ${lands}?`, right: C(ans, PROBES),
          slips: nums(ans, PROBES, [[a, 'top', `${a} is the top of the fraction. Work out ${a}/${b} of the ${n} probes.`], [n - ans, 'other', `That is about how many will NOT ${lands}.`], [n / b, 'one part', `That is 1/${b} of them. The chance is ${a}/${b}: ${a} of those parts.`], [ans + n / b, 'off', `Share the ${n} into ${b} equal parts, then take ${a} of them.`], [asPct ? a * 100 / b : n, asPct ? 'percent' : 'all', asPct ? `That is the percent. Work out ${said} of the ${n} probes.` : 'That is all of them. Only some will.']]),
          rightWhy: `${said} of ${n}: ${n} ÷ ${b} = ${n / b}; × ${a} = ${ans}`,
          sum: [{ op: 'div', a: n, b, say: `First share the ${n} into ${b} equal parts` }, { op: 'mul', a: n / b, b: a, say: `Then ${a} of those parts` }],
          help: { title: 'Parts of the whole', svg: gridPic({ cols: b, rows: 1, cells: Array.from({ length: b }, (_, i) => i < a), kind: K.key, ring: true, title: `${n} probes in ${b} equal parts` }), line: `${said} means ${a} of every ${b}. Share the ${n} probes into ${b} equal parts; ${a} of those parts land on ${K.what}.`, steps: [`${n} shared into ${b} parts`, `Then ${a} of those parts`] },
          own: { strand: 'ratio', at: 74 }, credit: [{ strand: 'frac', at: 40, weight: 0.5 }], facts: { form: 'expect', a, b, n, pct: asPct, ans }, size: 2,
        }, rand);
      }
      // two probes at once
      const PL = t.shuffle([...PLACES]).slice(0, 2);
      let A, B;
      for (let tries = 0; tries < 40; tries++) { const n1 = t.int(2, 4), n2 = t.int(2, 5); A = { n: n1, k: t.int(1, n1 - 1) }; B = { n: n2, k: t.int(1, n2 - 1) }; if (n1 * n2 <= 16) break; }
      const top = A.k * B.k, bot = A.n * B.n, right = Fr(top, bot), seen = new Set([right.val]);
      const slips = [[A.k + B.k, A.n + B.n, 'together', 'That puts both grids together as one. Each probe has its own grid: every square of one goes with every square of the other.'], [A.k * B.n + B.k * A.n, bot, 'added', 'That adds the two chances. Both at once is a part of a part: multiply them.'], [Math.max(A.k / A.n, B.k / B.n) === A.k / A.n ? A.k : B.k, Math.max(A.k / A.n, B.k / B.n) === A.k / A.n ? A.n : B.n, 'one', 'That is the chance for one probe. Both must land on it.'], [top, A.n + B.n, 'mixed', `On top the pairs that are both ${K.what}, underneath ALL the pairs: ${A.n} × ${B.n}.`], [top + 1, bot, 'off', 'Count the shaded pairs again.']]
        .filter(([a, b]) => a > 0 && b > 0 && !seen.has(a / b) && (seen.add(a / b), true)).map(([a, b, slip, why]) => ({ ...Fr(a, b), slip, why }));
      return ownOrder({
        key: 'chance:both', story: `One probe drops onto ${PL[0].name}: ${A.k} of its ${A.n} squares ${A.k === 1 ? 'has' : 'have'} ${K.what}. Another drops onto ${PL[1].name}: ${B.k} of its ${B.n} squares ${B.k === 1 ? 'has' : 'have'} ${K.what}.`,
        ask: `What is the chance both probes ${lands}?`, right, slips,
        rightWhy: `${A.k}/${A.n} × ${B.k}/${B.n} = ${top}/${bot}`,
        sum: [{ op: 'mul', a: A.k, b: B.k, say: 'On top: the pairs where both land on it' }, { op: 'mul', a: A.n, b: B.n, say: 'Underneath: all the pairs' }],
        lead: pairPic({ a: { ...A, label: PL[0].label }, b: { ...B, label: PL[1].label }, kind: K.key, shade: false }),
        help: { title: 'Every pair', svg: pairPic({ a: { ...A, label: PL[0].label }, b: { ...B, label: PL[1].label }, kind: K.key }), line: `Every square of ${PL[0].name} goes with every square of ${PL[1].name}: ${A.n} × ${B.n} pairs. The shaded pairs are both ${K.what}. Or multiply the two chances.`, steps: [`All the pairs: ${A.n} × ${B.n}`, `The pairs with ${K.what} in both: ${A.k} × ${B.k}`, 'The chance: those over all the pairs'] },
        own: { strand: 'frac', at: 78 }, credit: [{ strand: 'mul', at: 30, weight: 0.5 }], facts: { form: 'both', a: A, b: B, ans: right.v }, size: 2,
      }, rand);
    },
  },
};
const walk1 = (x) => (x > 0 ? `right ${x}` : x < 0 ? `left ${-x}` : 'no steps across');

// A TAP ON THE SURVEY MAP, judged as the pilot's are (src/jobs/pilot.js plotJudge): the crossing nearest the finger,
// fair to a finger a little off the lines. -> { at: [x, y], i (which of the card's answers: the right one, a named slip
// with its line why, or 'another spot', whose line is written here), right }
export function mapJudge(o, gx, gy) {
  const { map, at } = o.tap, hi = map.hi, lo = map.quad === 1 ? 0 : -hi, snap = (v) => Math.max(lo, Math.min(hi, Math.round(v))) + 0;   // (+ 0: never a minus zero)
  const x = snap(gx), y = snap(gy), v = pointText(x, y);
  let i = o.coins.findIndex((c) => c.v === v);
  if (i < 0) {
    i = o.coins.findIndex((c) => c.v === 'else');
    o.coins[i].why = `That spot is ${v}. For ${pointText(at[0], at[1])}, start at the Explorer, (0, 0): ${walkWords(at[0], at[1])}.`;
  }
  return { at: [x, y], i, right: !!o.coins[i].good };
}

const M = (maker, step, w = 1) => ({ maker, step, w });

export const PLACE = {
  id: 'survey', name: 'The survey table', short: 'Surveyor', math: 'Reading the scan: charts, averages, chance and the map', pic: 'survey', job: null,
  line: 'The Explorer\'s survey table on a captain\'s run: the scan\'s finds counted, picture charts, bar charts, line plots and a line graph, points on the map of the land below, averages, and the chance a probe lands on something.',
  levels: [
    { id: 'count', title: 'Count the finds', line: 'Up to 5: the ice the scan found in the crater', gen: { mix: [M('count', 1)] } },
    { id: 'sort', title: 'Sort them, then count', line: 'Ice, metal and crystals, up to 10: how many are metal?', gen: { mix: [M('count', 2, 2), M('count', 1)] } },
    { id: 'most', title: 'Which is there most of?', line: 'Ice, metal or crystals: which did the scan find most of', gen: { mix: [M('count', 3, 2), M('count', 2)] } },
    { id: 'pict', title: 'A picture chart', line: 'One picture for each find: how many at the ridge', gen: { mix: [M('pict', 1, 2), M('count', 3)] } },
    { id: 'pictMore', title: 'More, fewer and in all', line: 'How many more at the crater than at the dunes', gen: { mix: [M('pict', 2, 2), M('pict', 1)] } },
    { id: 'bar', title: 'A bar chart', line: 'Straight across from the top of the bar: how many at the valley', gen: { mix: [M('bar', 1, 2), M('pict', 2)] } },
    { id: 'barMore', title: 'Two bars compared', line: 'The gap between two bars: how many more, how many fewer', gen: { mix: [M('bar', 2, 2), M('bar', 1)] } },
    { id: 'barBy', title: 'Bars counted by 2s, 5s and 10s', line: 'The lines go up by 5s: how many at the plain', gen: { mix: [M('bar', 3, 2), M('bar', 2)] } },
    { id: 'pictBy', title: 'One picture for 2, 5 or 10', line: 'Each picture stands for 5: 4 pictures is 20', gen: { mix: [M('pict', 3, 2), M('bar', 3)] } },
    { id: 'dots', title: 'A line plot', line: 'A dot for each crystal over its length: how many were 6 cm long', gen: { mix: [M('dots', 1, 2), M('pict', 3)] } },
    { id: 'barTwo', title: 'Two steps on a bar chart', line: 'All four places together; one place against two others', gen: { mix: [M('bar', 4, 2), M('dots', 1)] } },
    { id: 'dotsOver', title: 'Longer than, and end to end', line: 'How many were longer than 5 cm; the longest less the shortest', gen: { mix: [M('dots', 2, 2), M('bar', 4)] } },
    { id: 'likely', title: 'Certain, likely, unlikely or impossible', line: '9 of the 12 squares have ice: will the probe land on ice?', gen: { mix: [M('chance', 1, 2), M('dots', 2)] } },
    { id: 'line', title: 'Warmth through the day', line: 'A line graph: when was it warmest; how much warmer at 11:00', gen: { mix: [M('line', 1, 2), M('chance', 1)] } },
    { id: 'map', title: 'Points on the map', line: 'The upper right quarter: tap the spot (4, 3), or read one', gen: { mix: [M('map', 1, 2), M('line', 1)] } },
    { id: 'average', title: 'The average', line: '12, 18, 9 and 17 °C: add them, then share the total out', gen: { mix: [M('mean', 1, 2), M('map', 1)] } },
    { id: 'mapAll', title: 'The whole map', line: 'With negatives: tap the spot (−4, 2), or read one', gen: { mix: [M('map', 2, 2), M('mean', 1)] } },
    { id: 'middle', title: 'The middle, the most common, the spread', line: 'The median, the mode and the range of 5 or 7 readings', gen: { mix: [M('mean', 3, 2), M('map', 2)] } },
    { id: 'apart', title: 'How far across the map', line: 'From (−3, 2) across to (4, 2): over 0', gen: { mix: [M('map', 3, 2), M('mean', 3)] } },
    { id: 'missing', title: 'A missing reading', line: 'The average of 4 readings is 15: three are 12, 18 and 13', gen: { mix: [M('mean', 2, 2), M('map', 3)] } },
    { id: 'fraction', title: 'Chance as a fraction', line: '3 of the 12 squares have ice: the chance is 3/12', gen: { mix: [M('chance', 2, 2), M('mean', 2)] } },
    { id: 'percent', title: 'Chance as a percent', line: '5 of the 20 squares: a 25% chance', gen: { mix: [M('chance', 3, 2), M('chance', 2)] } },
    { id: 'expect', title: 'About how many probes', line: 'A 3/10 chance, 20 probes dropped: about 6', gen: { mix: [M('chance', 4, 2), M('chance', 3)] } },
    { id: 'both', title: 'Two probes at once', line: '1/2 at the crater and 2/3 at the ridge: the chance of both', gen: { mix: [M('chance', 5, 2), M('chance', 4)] } },
  ],
};

export const JOB = {
  // (not one of the station's job spots, src/jobs/index.js JOBS: its place is the Explorer's survey table, and its
  // cards come up on Captain Vega's run, as the pilot's and the engineer's do on the mining run. Until that run is
  // made, its cards are tried in the Explore Lab: labs/explore/)
  id: 'survey', name: 'Survey table', short: 'Surveyor', open: true, seated: true,
  spot: null, sign: 'Survey table', hint: 'Read the scan',
  place: PLACE, setting: null, makers: MAKERS,
  card: 'survey',
  dark: true,      // its pictures are drawn dark, with light lines (src/jobs/surveyview.js)
};
