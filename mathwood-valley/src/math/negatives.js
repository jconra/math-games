// The "Positive & negative" trainer behind the round-up: adding and taking away with negative numbers.
//
// A wave is a few cards ("−10 + 18"), played one after another. Each card brings its own small herd of
// answers: one right, and the rest are the real slips kids make, never random numbers:
//   way   went the wrong way along the line (−10 + 18 → −28: went down 18 instead of up). This is the slip
//         from the test that started this topic: 3x − 10 = 5x − 18, +18 both sides, and −10 + 18 written as −28.
//   sign  the right size but the wrong side of zero (−10 + 18 → −8)
//   drop  dropped the signs and added the sizes (−10 + 18 → 28)
//   start started on the wrong side of zero (−4 − 5 done as 4 − 5 → −1); the opposite of "way"
//   near  one off: counted the marks instead of the spaces between them (−10 + 18 → 7 or 9)
// Every card (4 to 6 answers) has the answer, way, sign and start (for −10 + 18, start is 28, the same as
// drop). Bigger cards add one-off slips ("near", "signNear" = wrong side and one off, "wayNear", ...), each
// next to one of those picked at random. Why that leaves no shortcut is in makeCard's notes: nothing a kid can
// see in the numbers alone points to the right one much better than a guess.
//
// The ladder starts easy and climbs (see LADDER below). The step moves with the answers, one card at a time
// (only the first try at a card counts):
//   - 3 clean cards in a row on the kid's own step move up a step (review cards and comebacks don't count
//     toward it); a miss moves down a step, at most once per wave.
//   - On a kid's first visit the step climbs after every clean card. The climb ends at the second miss (one
//     slip is forgiven), and the kid settles two steps below the step they had reached.
//   - Each session opens with 2 easy warm-up waves from below the kid's step; they never move it.
//   - Once placed, every third card comes from an earlier step (mixed practice sticks better).
//   - A missed card comes back 2 to 4 cards later (in the same wave when there is room), and again next session.
//
// Everything it remembers lives in the plain object it is given (rider.topics.negatives), so it saves as JSON
// with the rider, and a reload mid-wave carries on where it was. Nothing is kept anywhere else.
//
//   const N = makeNegatives(rider.topics.negatives ||= {})
//   const w = N.wave({ count: 5 })     -> { rule: '−10 + 18 = ?', card, cards, targets, step, hard, fresh, warmup, ... }
//   N.card()                           -> the card to show now (null when the wave is done)
//   N.answer(n, good)                  -> { right, step, moved, placed, comeback, card, waveDone, first }
//   N.explain(card, picked)            -> { slip, line, numberLine }   after a wrong pick
//   N.help(card)                       -> number-line options with the answer hidden, for "Show me" / 8 s of thinking
//   N.hint(card), N.level(), N.report(), N.setStep(n)
//   N.steer(step, { placing })         the rider's skill model (src/math/skill.js) sets the step from now on (see steer)
//
// Every number shown uses the real minus sign (U+2212), and a negative being added or taken away is
// written in brackets: 5 − (−3), 4 + (−9). Words say "negative six" for a value and "minus" only for taking away.

// ---- the dials (defaults; change them here) --------------------------------------------------------------------

export const CLEAN_TO_CLIMB = 3;        // clean cards in a row to move up a step
export const MAX_DOWN_PER_WAVE = 1;     // a rough wave can drop the kid this many steps at most
export const PLACEMENT_MISSES = 2;      // the first-visit climb ends at this many misses (one slip is forgiven)
export const PLACE_BELOW = 2;           // the climb ends this many steps below the step the kid had reached
// With 2 below, first-visit kids land ON AVERAGE about half a step (weaker kids) to a step and a half (the
// strongest) above where they go on to settle; with 1 below, about 1.5 to 2 steps above once review cards stopped
// counting toward the climb. The strongest kids land highest because about half of them climb straight to the top
// step on their first visit (reaching the top ends the climb), and the misses there bring them down a step a
// wave. Single kids land further off than the average: up to 6 in 10 of the strongest land 2 or more steps above.
// Do right answers on review cards (from an earlier step) and comebacks count toward the 3 in a row? No. They
// are easier than the kid's own step, so counting them lifted kids to a step where only about 65% of first
// tries were right. Without them simulated kids settle about a step lower, near 81% right on their own step's
// cards (80 to 83% over 30 seed sets of 4 kids). The times tables count the step's own waves only, too.
export const REVIEWS_COUNT_UP = false;
export const WARMUP_WAVES = 2;          // easy waves at the start of each session
export const WARMUP_BELOW = 2;          // how many steps below the kid's step the warm-ups come from
export const REVIEW_EVERY = 3;          // once placed, one card in this many comes from an earlier step
export const CARDS_PER_WAVE = 3;        // cards in a wave
export const TARGETS_PER_CARD = 5;      // answers on a card (one right); count can ask for 4 to 6 (see makeCard)
export const EASY_TARGETS = 4;          // answers on warm-up cards and on a step's first cards
export const COMEBACK_MIN = 2;          // a missed card comes back this many cards later...
export const COMEBACK_MAX = 4;          // ...up to this many
export const MAX_BACKS_PER_WAVE = 2;    // returning cards in one wave at most
export const TWINS_CHANCE = 0.35;       // on the top steps: the chance a wave has −a + b and −a − b side by side
export const SESSION_GAP_MS = 30 * 60 * 1000;   // a gap this long between answers starts a new session
const REVIEW_KEEP = 40;                 // missed cards kept for later sessions
const SOON_KEEP = 30;                   // missed cards waiting to come back this session

const MINUS = '−';   // the real minus sign (U+2212)

// The four real slips the topic is built around (see the top of the file). A card's wrong answers are named
// with these and the kinds made from them (start, signNear, wayNear, dropNear, startNear, near2): see classify.
export const SLIP_KINDS = ['way', 'sign', 'drop', 'near'];

// ---- the ladder ----------------------------------------------------------------------------------------------------
// Each step: the shapes of problem it deals, and how big its numbers get.
//   upPos  −a + b landing above zero (−3 + 7)      upNeg  −a + b landing below zero (−7 + 3)
//   down   −a − b, both going down (−4 − 5)          cross  a − b taking away past zero (3 − 8)
//   subNeg a − (−b), taking away a negative (5 − (−3))   addNeg  a + (−b), adding a negative (4 + (−9))
//   tidy   −a + b and −a − b: the tidy-up step of an equation (−10 + 18, −10 − 18)
//   zero   −a + a, a zero pair (−6 + 6)
//   short  a − b that stays above zero (8 − 3): only as a contrast for steps 3 and 4
//   double the same number twice (−5 − 5, −5 + (−5), 5 − (−5)): going the wrong way lands on 0, a real slip
//          ("−5 − 5 is 0"), so a 0 on the card isn't always the answer to a zero pair
// On steps 1 to 4 every answer of the step's own shapes has the same sign, so a kid could pick "the positive
// one" without looking at the problem. Now and then (CONTRAST_CHANCE) such a step deals its `contrast` shape
// instead, whose answer has the other sign: the kid has to see which way the hop goes every time. Step 3's
// contrast is 8 − 3 (a minus with an answer above zero), so "minus means a negative answer" doesn't work
// there either.

const ALL = ['upPos', 'upNeg', 'down', 'cross', 'subNeg', 'addNeg', 'tidy', 'zero', 'double'];
export const LADDER = [
  { shapes: ['upPos'], contrast: 'upNeg', max: 10, label: `Negative plus positive, landing above zero (${MINUS}3 + 7)` },
  { shapes: ['upNeg', 'zero'], contrast: 'upPos', max: 10, label: `Negative plus positive, landing below zero (${MINUS}7 + 3)` },
  { shapes: ['down'], contrast: 'short', max: 10, label: `A negative going further down (${MINUS}4 ${MINUS} 5)` },
  { shapes: ['cross'], contrast: 'short', max: 12, label: `Taking away past zero (3 ${MINUS} 8)` },
  { shapes: ['subNeg', 'addNeg'], max: 10, label: `Taking away a negative (5 ${MINUS} (${MINUS}3)) and adding one (4 + (${MINUS}9))` },
  { shapes: ALL, max: 20, label: `All of them up to 20 (${MINUS}10 + 18, ${MINUS}10 ${MINUS} 18)` },
  { shapes: ALL, max: 50, label: 'All of them up to 50' },
];
export const CONTRAST_CHANCE = 0.25;   // on steps 1 to 4: the chance a card has the other sign (see above)
// Which way each shape's sum goes: '+' adds (−3 + 7, 4 + (−9)), '−' takes away (−4 − 5, 5 − (−3)), '±' either. A card
// counts in the rider's Addition or Subtraction (src/math/skill.js) by its own sign; signsAt says which a step deals.
export const SHAPE_SIGN = { upPos: '+', upNeg: '+', zero: '+', addNeg: '+', down: '-', cross: '-', short: '-', subNeg: '-', tidy: '±', double: '±' };
export function signsAt(step) {
  const row = LADDER[Math.max(1, Math.min(LADDER.length, Math.round(step) || 1)) - 1], out = new Set();
  for (const sh of [...row.shapes, ...(row.contrast ? [row.contrast] : [])]) {
    const g = SHAPE_SIGN[sh];
    if (g === '±') { out.add('+'); out.add('-'); } else if (g) out.add(g);
  }
  return [...out];
}
// How often each shape comes up on the mixed steps: the equation tidy-up shapes most. A shape that was just
// dealt is less likely to come straight back (REPEAT_WEIGHT), without ruling it out.
const MIX_WEIGHT = { tidy: 3, upPos: 1, upNeg: 1, down: 1, cross: 1, subNeg: 1, addNeg: 0.8, zero: 0.3, double: 0.5 };
const REPEAT_WEIGHT = 0.3;
const SHAPE_WEIGHT = { zero: 0.2 };   // on step 2, a zero pair now and then (about 1 card in 6)

// A small seeded random-number maker, for tests and rigs that need the same cards every run.
export function seeded(seed = 1) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- numbers as text and as words ----------------------------------------------------------------------------------

// A value as printed: −8, 0, 18.
export const numText = (n) => (n < 0 ? MINUS : '') + Math.abs(n);

// The problem as printed. A leading negative has no brackets; a negative being added or taken away does.
//   problemText(-10, '+', 18) -> '−10 + 18'      problemText(5, '-', -3) -> '5 − (−3)'
export function problemText(s, op, t) {
  const term = t < 0 ? `(${numText(t)})` : String(t);
  return `${numText(s)} ${op === '-' ? MINUS : '+'} ${term}`;
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
// A value in words: "negative six" (never "minus six": minus is only for taking away).
export function words(n) {
  if (n < 0) return `negative ${words(-n)}`;
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '');
  return String(n);
}
// The problem said out loud: "negative ten plus eighteen", "five minus negative three".
export function problemWords(s, op, t) { return `${words(s)} ${op === '-' ? 'minus' : 'plus'} ${words(t)}`; }

// ---- one card ------------------------------------------------------------------------------------------------------

// The slips for a problem: the value each kind of wrong answer would give.
//   change: how far the hop goes (+ up, − down). answer = start + change.
export function slipsFor(s, op, t) {
  const c = op === '-' ? -t : t, r = s + c;
  const way = s - c, drop = Math.abs(s) + Math.abs(c);
  return {
    way,                                     // went the other way along the line
    sign: -r,                                // right steps, wrong side of zero
    drop,                                    // dropped the minus signs and added the sizes
    start: -way,                             // started on the wrong side of zero (−s + c): −4 − 5 done as 4 − 5
    near: [r - 1, r + 1],                    // one off
    signNear: [1 - r, -1 - r],               // wrong side of zero, and one off
    wayNear: [way - 1, way + 1],             // went the wrong way, and one off
    dropNear: [drop - 1, drop + 1],          // dropped the signs, and one off
    startNear: [-way - 1, -way + 1],         // started on the wrong side, and one off
    near2: [r - 2, r + 2],                   // two off (only when a tiny problem runs out of other numbers)
  };
}
// (Dropping the signs always gives one of the others, or the answer: for −10 + 18 it is 28, the same as
// starting at 10; for −4 − 5 it is 9, the same as the wrong side of zero. It keeps its own name where it fits.)

// Which slip a wrong answer is, checked in this order: way, sign, drop, start, near, signNear, wayNear,
// dropNear, startNear, near2, else 'other'. null for the right answer. A number can fit two kinds (for −4 − 5,
// 9 is both "sign" and "drop"): the first wins. (Older saved cards may still say 'mirror': explainPick works
// the name out again from the numbers, so those read like 'start'.)
export function classify(s, op, t, n) {
  const sl = slipsFor(s, op, t), r = s + (op === '-' ? -t : t);
  if (n === r) return null;
  if (n === sl.way) return 'way';
  if (r !== 0 && n === sl.sign) return 'sign';
  if (n === sl.drop) return 'drop';
  if (n === sl.start) return 'start';
  if (Math.abs(n - r) === 1) return 'near';
  if (r !== 0 && Math.abs(n + r) === 1) return 'signNear';
  if (Math.abs(n - sl.way) === 1) return 'wayNear';
  if (Math.abs(n - sl.drop) === 1) return 'dropNear';
  if (Math.abs(n - sl.start) === 1) return 'startNear';
  if (Math.abs(n - r) === 2) return 'near2';
  return 'other';
}

// The card for a problem, with its answers. `size` = how many answers (4 to 6, one right; 3 is dealt as 4,
// because three numbers always leave a shortcut, see below).
// rand: a random function (which one-off slips are dealt, and the order of the answers).
// avoid: numbers not to deal as one-off slips (the trainer passes the answer of the card before, so a kid can't
// cross it off as "that was the last answer").
//
// How a card is made, and why it has no shortcut. Every problem has four "anchor" numbers, in two pairs of
// opposites, and each one is a real slip:
//   the answer (8) and the wrong side of zero (−8);
//   the wrong way (−28) and starting on the wrong side of zero (28, which here is also "dropped the signs").
//   (For −4 − 5: −9 and 9, then 1 and −1, where −1 is 4 − 5.)
// The rest are one-off slips, each next to an anchor picked at random (7 or 9 next to the answer, −27 or −29
// next to the wrong way, and so on):
//   4 answers: the four anchors
//   5 or 6 answers: the four anchors, and one or two one-off slips
// When the wrong way lands on zero (−6 − 6, 6 − (−6): a real slip, "−6 − 6 is 0"), starting on the wrong side
// lands there too, so there are only three anchors: the answer, its opposite and 0. Then the one-off slips
// come as an opposite pair (1 and −1, or 11 and −13 beside −12 and 12), so the answer isn't the only number
// with its opposite on the card. (With 4 answers there is no room for a pair: those cards stay as they are.)
// Three answers can't be made fair: with the answer, the wrong way and one more, either the answer is the
// only number of its sign, or it is half of the only opposite pair, or the third one's place gives it away.
// So from the numbers alone the answer looks like any other anchor: its opposite is there, it is odd or even
// like them, and a next-door number is no likelier beside it than beside the others. What tells them apart is
// which side of zero the hop lands and how far it goes, which is the sum itself. (An earlier version picked
// the wrong answers to even out a list of rules of thumb; a scorer that learns from cards found the patterns
// those choices left, so the choice is now plain chance.) The went-the-wrong-way slip, the one this topic is
// here for, is on every card, and the answer is never the only positive or the only negative one.
export function makeCard(s, op, t, { size = TARGETS_PER_CARD, rand = Math.random, shape = null, rung = null, avoid = null } = {}) {
  const c = op === '-' ? -t : t, r = s + c;
  const sl = slipsFor(s, op, t);
  size = Math.max(4, Math.min(6, Math.round(Number.isFinite(size) ? size : TARGETS_PER_CARD)));
  const want = size - 1;
  const skip = new Set((Array.isArray(avoid) ? avoid : [avoid]).filter(Number.isInteger));
  const ok = (n, list) => Number.isInteger(n) && n !== r && Math.abs(n) <= 150 && !list.includes(n);
  // the anchors: her slip first, then the wrong side of zero, then starting on the wrong side
  const anchors = [];
  for (const n of [sl.way, sl.sign, sl.start]) if (ok(n, anchors)) anchors.push(n);
  // one-off slips: one away from the answer or a wrong anchor (and two away from the answer as a last resort)
  const offs = [];
  for (const a of [r, sl.sign, sl.way, sl.start]) for (const d of [-1, 1]) if (ok(a + d, offs) && !anchors.includes(a + d) && !skip.has(a + d)) offs.push(a + d);
  const spare = [];
  for (const n of [...sl.near2, ...[sl.sign, sl.way, sl.start].flatMap((a) => [a - 2, a + 2])]) if (ok(n, spare) && !anchors.includes(n) && !offs.includes(n) && !skip.has(n)) spare.push(n);
  const sgn = Math.sign(r);
  // the wrong way landing on zero: a pair of opposite one-offs, picked at random (see above)
  const pairs = sl.way === 0 && want - anchors.length >= 2
    ? [[1, -1], [r + 1, -r - 1], [r - 1, -r + 1]].filter(([a, b]) => offs.includes(a) && offs.includes(b))
    : [];
  let wrong = null;
  for (let tries = 0; tries < 12 && !wrong; tries++) {
    const pool = offs.slice(), set = anchors.slice(0, want);
    if (pairs.length) for (const n of pairs[Math.floor(rand() * pairs.length)]) set.push(pool.splice(pool.indexOf(n), 1)[0]);
    // 0 goes first when it is a one-off slip (−4 + 3 is −1, and 0 is one off): otherwise a 0 would only ever
    // be on the card as the answer to a zero pair, and "pick the 0" would work
    if (tries === 0 && pool.includes(0) && set.length < want) set.push(pool.splice(pool.indexOf(0), 1)[0]);
    while (set.length < want && pool.length) set.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    for (const n of spare) if (set.length < want) set.push(n);
    // never the only positive or the only negative one (else "the positive one" would do); try other one-offs
    if (!sgn || set.some((n) => Math.sign(n) === sgn) || tries === 11) wrong = set;
  }

  // each wrong answer is named by the first kind of slip it fits (see classify)
  const targets = [{ n: r, good: true, trap: null }, ...wrong.map((n) => ({ n, good: false, trap: classify(s, op, t, n) }))];
  for (let i = targets.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [targets[i], targets[j]] = [targets[j], targets[i]]; }
  return {
    text: problemText(s, op, t),
    say: problemWords(s, op, t),
    answer: r,
    parts: { start: s, change: c, op, term: t },
    shape, rung,
    targets: targets.map((x) => ({ ...x, label: numText(x.n) })),
  };
}

// ---- words for the kid ---------------------------------------------------------------------------------------------

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const low = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const steps = (n) => `${n} step${n === 1 ? '' : 's'}`;

// The hop in words: "10 steps to zero, 8 more", "from −7, up 3 is −4".
function walk(s, c) {
  const r = s + c, d = c > 0 ? 'up' : 'down';
  if (s === 0) return `from zero, ${d} ${Math.abs(c)} is ${numText(r)}`;
  if (r === 0) return `from ${numText(s)}, ${steps(Math.abs(c))} ${d} lands right on zero`;
  if (Math.sign(s) !== Math.sign(r)) return `${steps(Math.abs(s))} to zero, ${Math.abs(r)} more`;
  return `from ${numText(s)}, ${d} ${Math.abs(c)} is ${numText(r)}`;
}
// The same, spelled out from the start: "from −10, 10 steps up reaches zero, then 8 more lands on 8".
function walkLong(s, c) {
  const r = s + c, d = c > 0 ? 'up' : 'down';
  if (s !== 0 && r !== 0 && Math.sign(s) !== Math.sign(r)) return `from ${numText(s)}, ${steps(Math.abs(s))} ${d} reaches zero, then ${Math.abs(r)} more lands on ${numText(r)}`;
  return walk(s, c);
}
// What the written sign does: "Adding 18 goes UP the line".
function moveWords(op, t) {
  if (op === '+' && t >= 0) return `Adding ${t} goes UP the line`;
  if (op === '-' && t >= 0) return `Taking away ${t} goes DOWN the line`;
  if (op === '-') return `Taking away ${numText(t)} turns around and goes UP ${-t}`;
  return `Adding ${numText(t)} goes DOWN ${-t}`;
}
// Which signs "dropping the signs" dropped: a negative number's own sign is "the negative sign", the taking-away
// sign is "the minus sign" (the topic's wording: "negative six" for a value, "minus" only for taking away).
function droppedWhich(s, op, t) {
  const startNeg = s < 0, changeNeg = (op === '-' ? -t : t) < 0;
  if (startNeg && changeNeg) return 'the signs';
  if (startNeg) return 'the negative sign';
  if (changeNeg) return op === '-' ? 'the minus sign' : 'the negative sign';
  return 'the signs';
}

// The plain line after a wrong pick, tied to the slip the kid made.
export function explainPick(card, picked) {
  const { start: s, change: c, op, term: t } = card.parts;
  const r = s + c;
  if (picked === r) return { slip: null, line: `${card.text} = ${numText(r)}: ${walk(s, c)}.` };
  const slip = classify(s, op, t, picked);
  const move = moveWords(op, t), d = c > 0 ? 'up' : 'down';
  const below = s < 0 ? `${numText(s)} starts BELOW zero` : move;
  let line;
  if (picked === s && s !== 0) {
    // the number she started on: the hop never happened (the picture marks it "start (your pick)")
    line = `That's where you started. ${move}: ${walk(s, c)}.`;
  } else if (slip === 'way') {
    if (op === '+' && t >= 0) line = `You went down ${t}. Adding ${t} goes UP the line: ${walk(s, c)}.`;
    else if (op === '-' && t >= 0) line = `You went up ${t}. Taking away ${t} goes DOWN the line: ${walk(s, c)}.`;
    else if (op === '-') line = `You took away ${-t}. Taking away ${numText(t)} turns around and goes UP ${-t}: ${walk(s, c)}.`;
    else line = `You went up ${-t}. Adding ${numText(t)} goes DOWN ${-t}: ${walk(s, c)}.`;
  } else if (slip === 'sign') {
    if (s !== 0 && Math.sign(s) !== Math.sign(r)) line = `Right size, wrong side of zero. ${cap(walkLong(s, c))}.`;
    else if (Math.sign(s) === Math.sign(r) && Math.sign(c) !== Math.sign(s)) line = `Wrong side of zero. ${cap(walk(s, c))}: it never gets as far as zero.`;
    else line = `Wrong side of zero. You start ${s < 0 ? 'below' : 'above'} zero and go further ${c < 0 ? 'down' : 'up'}: ${walk(s, c)}.`;
  } else if (slip === 'drop') {
    line = `You dropped ${droppedWhich(s, op, t)} and added ${Math.abs(s)} and ${Math.abs(c)} to get ${Math.abs(s) + Math.abs(c)}. But ${low(below)}: ${walk(s, c)}.`;
  } else if (slip === 'start') {
    line = `You started at ${numText(-s)}, but ${card.text} starts at ${numText(s)}: ${walk(s, c)}.`;
  } else if (slip === 'near') {
    // on a short hop the slip is usually counting the marks; on a long one it is just the sum
    line = Math.abs(c) <= 12 ? `Just one off. Count the spaces between the marks, not the marks: ${walk(s, c)}.` : `Just one off. ${cap(walk(s, c))}.`;
  } else if (slip === 'near2') {
    line = Math.abs(c) <= 12 ? `Two off. Count ${d} from ${numText(s)} one space at a time: ${walk(s, c)}.` : `Two off. ${cap(walk(s, c))}.`;
  } else if (slip === 'signNear') {
    line = `Wrong side of zero, and one off. ${cap(walkLong(s, c))}.`;
  } else if (slip === 'wayNear') {
    line = `Wrong way, and one off. ${move}: ${walk(s, c)}.`;
  } else if (slip === 'dropNear') {
    line = `Dropped ${droppedWhich(s, op, t)}, and one off. ${below}: ${walk(s, c)}.`;
  } else if (slip === 'startNear') {
    line = `Started on the wrong side of zero, and one off. ${card.text} starts at ${numText(s)}: ${walk(s, c)}.`;
  } else {
    line = `Not quite. ${move}: ${walk(s, c)}.`;
  }
  return { slip, line };
}

// A nudge for a kid who is stuck, without giving the answer away.
export function nudge(card) {
  const { start: s, change: c, op, term: t } = card.parts;
  const r = s + c, d = c > 0 ? 'up' : 'down';
  if (op === '-' && t < 0) return `Taking away a negative is the same as adding: ${card.text} is the same as ${problemText(s, '+', -t)}.`;
  if (op === '+' && t < 0) return `Adding a negative is the same as taking away: ${card.text} is the same as ${problemText(s, '-', -t)}.`;
  const move = op === '+' ? `Adding ${t} goes ${d}` : `Taking away ${t} goes ${d}`;
  if (s !== 0 && r !== 0 && Math.sign(s) !== Math.sign(r)) return `${move}. ${cap(steps(Math.abs(s)))} gets you to zero. How many more?`;
  return `${move}. Start at ${numText(s)} and count ${d} ${Math.abs(c)}.`;
}

// ---- the trainer ---------------------------------------------------------------------------------------------------

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));
const keyOf = (p) => `${p.s}${p.op}${p.t}`;
const answerOf = (p) => p.s + (p.op === '-' ? -p.t : p.t);
// The numbers a problem's card always shows besides its answer (see makeCard): the wrong way, the wrong side of
// zero, and starting on the wrong side.
const anchorsOf = (p) => { const sl = slipsFor(p.s, p.op, p.t); return [sl.way, sl.sign, sl.start]; };

const okProblem = (x) => isObj(x) && Number.isInteger(x.s) && (x.op === '+' || x.op === '-') && Number.isInteger(x.t);
const okCard = (c) => isObj(c) && typeof c.text === 'string' && Number.isInteger(c.answer) && isObj(c.parts) && Array.isArray(c.targets) && c.targets.length >= 2;

// Fill in whatever the saved object is missing, and repair anything that isn't the right shape.
function fill(S) {
  S.v = 1;
  S.step = clampInt(num(S.step, 1), 1, LADDER.length);
  S.placed = S.placed === true;
  S.placeMisses = clampInt(num(S.placeMisses, 0), 0, 9);
  S.streak = clampInt(num(S.streak, 0), 0, 99);
  S.clock = Math.max(0, Math.floor(num(S.clock, 0)));      // cards finished; the comeback timer counts these
  S.waves = Math.max(0, Math.floor(num(S.waves, 0)));
  S.session = Math.max(0, Math.floor(num(S.session, 0)));
  S.warmups = clampInt(num(S.warmups, 0), 0, WARMUP_WAVES);
  S.sinceReview = clampInt(num(S.sinceReview, 0), 0, 99);
  S.lastAt = num(S.lastAt, 0);
  S.lastShape = typeof S.lastShape === 'string' ? S.lastShape : null;
  S.balance = Math.max(-4, Math.min(4, num(S.balance, 0)));
  if (!isObj(S.rungs)) S.rungs = {};
  for (const k of Object.keys(S.rungs)) {
    const r = S.rungs[k];
    if (!isObj(r)) { delete S.rungs[k]; continue; }
    r.cards = num(r.cards, 0); r.right = num(r.right, 0); r.wrong = num(r.wrong, 0); r.helped = num(r.helped, 0);
  }
  if (!isObj(S.slips)) S.slips = {};
  for (const k of Object.keys(S.slips)) {
    const r = S.slips[k];
    if (!isObj(r)) { delete S.slips[k]; continue; }
    r.seen = num(r.seen, 0); r.fooled = num(r.fooled, 0);
  }
  S.lastAns = Number.isInteger(S.lastAns) ? S.lastAns : null;   // the answer of the last card finished
  const base = (x) => ({ s: x.s, op: x.op, t: x.t, rung: clampInt(num(x.rung, 1), 1, LADDER.length), shape: typeof x.shape === 'string' ? x.shape : null });
  // soon: { due, old } (old = carried over from last session); review: { sess, misses }
  S.soon = Array.isArray(S.soon) ? S.soon.filter(okProblem).map((x) => ({ ...base(x), due: num(x.due, 0), old: x.old === true })).slice(-SOON_KEEP) : [];
  S.review = Array.isArray(S.review) ? S.review.filter(okProblem).map((x) => ({ ...base(x), sess: num(x.sess, 0), misses: num(x.misses, 1) })).slice(-REVIEW_KEEP) : [];
  if (!(isObj(S.cur) && Array.isArray(S.cur.cards) && S.cur.cards.every(okCard))) S.cur = null;
  if (S.cur) {
    S.cur.at = clampInt(num(S.cur.at, 0), 0, S.cur.cards.length);
    // the number for the wave's next new card (older saves didn't keep it: carry on after the highest one)
    const most = Math.max(0, ...S.cur.cards.map((c) => Number(String(c.id || '').split('.')[1]) || 0));
    S.cur.nextId = Math.max(most + 1, Math.floor(num(S.cur.nextId, 0)));
  }
  return S;
}

// state: rider.topics.negatives (filled in and changed in place). opts: { rand, now, newSession } for tests and
// rigs: a seeded random maker, a clock, and a way to force a new session.
export function makeNegatives(state, opts = {}) {
  const S = fill(isObj(state) ? state : {});
  const R = typeof opts.rand === 'function' ? opts.rand : Math.random;
  const now = typeof opts.now === 'function' ? opts.now : () => Date.now();

  const int = (lo, hi) => (hi < lo ? lo : lo + Math.floor(R() * (hi - lo + 1)));
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  function pickW(arr, w) {
    let sum = 0;
    const ws = arr.map((x) => { const v = Math.max(0, w(x)); sum += v; return v; });
    if (sum <= 0) return pick(arr);
    let r = R() * sum;
    for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r < 0) return arr[i]; }
    return arr[arr.length - 1];
  }
  const rungStat = (k) => (S.rungs[k] ||= { cards: 0, right: 0, wrong: 0, helped: 0 });
  const slipStat = (k) => (S.slips[k] ||= { seen: 0, fooled: 0 });

  // ----- sessions

  function newSession() {
    S.session++;
    S.warmups = S.placed && S.waves > 0 ? WARMUP_WAVES : 0;
    S.sinceReview = 0;
    // Last session's misses come back early this session (right after the warm-ups): the most-missed ten,
    // newest first among equals. The rest wait for a later session. They are marked old, so a card missed
    // this session still comes back on time instead of waiting behind them.
    const order = S.review.map((r, i) => ({ r, i })).sort((x, y) => (y.r.misses || 1) - (x.r.misses || 1) || y.i - x.i);
    S.soon = order.slice(0, 10).map(({ r }) => ({ s: r.s, op: r.op, t: r.t, rung: r.rung, shape: r.shape, due: S.clock, old: true }));
    S.lastAt = now();
  }

  // ----- problems

  // A problem of one shape with numbers up to `max`. Bigger steps lean toward bigger numbers.
  function problem(shape, max) {
    const low = max >= 50 ? 4 : max >= 20 ? 2 : 1;
    const big = (lo) => int(Math.max(lo, Math.ceil(max / 3)), max);   // the bigger number of the two
    for (let tries = 0; tries < 30; tries++) {
      let p;
      switch (shape) {
        case 'upPos': { const b = big(low + 1); const a = int(low, b - 1); p = { s: -a, op: '+', t: b }; break; }
        case 'upNeg': { const a = big(low + 1); const b = int(low, a - 1); p = { s: -a, op: '+', t: b }; break; }
        case 'zero': { const a = int(Math.max(2, low), max); p = { s: -a, op: '+', t: a }; break; }
        case 'down': { const a = int(low, max - 1); const b = int(low, Math.max(low, Math.min(max, max - a + 4))); p = { s: -a, op: '-', t: b }; break; }
        case 'cross': { const b = big(low + 1); const a = int(low, b - 1); p = { s: a, op: '-', t: b }; break; }
        case 'short': { const a = big(low + 1); const b = int(low, a - 1); p = { s: a, op: '-', t: b }; break; }
        case 'double': { const a = int(Math.max(2, low), Math.max(2, Math.floor(max / 2))); const k = R(); p = k < 0.4 ? { s: -a, op: '-', t: a } : k < 0.7 ? { s: -a, op: '+', t: -a } : { s: a, op: '-', t: -a }; break; }
        case 'subNeg': { const a = int(low, max - 1) * (R() < 0.7 ? 1 : -1); const b = int(low, max - 1); p = { s: a, op: '-', t: -b }; break; }
        case 'addNeg': { const a = int(low, max) * (R() < 0.75 ? 1 : -1); const b = int(low, max); p = { s: a, op: '+', t: -b }; break; }
        case 'tidy':
        default: { const a = int(Math.max(2, low), max); let b = int(Math.max(2, low), max); if (b === a) b = a < max ? a + 1 : a - 1; p = { s: -a, op: R() < 0.5 ? '+' : '-', t: b }; break; }
      }
      const r = p.s + (p.op === '-' ? -p.t : p.t);
      if (Math.abs(r) <= 99 && (shape === 'zero' || p.s !== 0)) return { ...p, shape };
    }
    return { s: -3, op: '+', t: 7, shape: 'upPos' };
  }

  // A shape for a step. Steps 1 to 4 now and then deal their contrast shape (the other sign). On the mixed
  // steps the shape just dealt is less likely to come straight back; on a step with one or two shapes the
  // weights alone decide (so step 2's zero pairs stay "now and then").
  function shapeFor(step) {
    const row = LADDER[step - 1];
    if (row.contrast && R() < CONTRAST_CHANCE) return row.contrast;
    if (row.shapes.length > 2) return pickW(row.shapes, (x) => (MIX_WEIGHT[x] ?? 1) * (x === S.lastShape ? REPEAT_WEIGHT : 1));
    return pickW(row.shapes, (x) => SHAPE_WEIGHT[x] ?? 1);
  }

  // Card ids are "<wave>.<n>". A wave being dealt counts in `dealing`; once it is the current wave, the count is
  // kept in the saved wave (S.cur.nextId), so cards added after a reload never repeat an id.
  let dealing = 1;
  // extra.after: the answer of the card that will be shown just before this one (never dealt as a one-off slip
  // here, or a kid learns "that was the last answer, so not this one").
  function cardFor(p, rung, size, extra = {}) {
    const c = makeCard(p.s, p.op, p.t, { size, rand: R, shape: p.shape || null, rung, avoid: extra.after });
    const id = extra.into ? `${extra.into.id}.${extra.into.nextId++}` : `${S.waves + 1}.${dealing++}`;
    const { into, after, ...rest } = extra;
    return { id, ...c, back: false, review: false, ...rest, tried: false, done: 0, misses: 0 };
  }

  // Can the card for problem p go at `pos` in `list`? Never the same answer on two cards in a row; never the
  // answer of the card before among this card's numbers, nor this card's answer among the next card's (a kid
  // would learn to cross off "that was the last answer"); and never between the two equation twins. The card
  // before position `from` (where play is now) is the last one finished, possibly in the wave before.
  // twin: p is the second twin, whose went-the-wrong-way slip is the first twin's answer (that is the point of
  // the pair: −10 + 18 is 8, and 8 is what −10 − 18 comes to when it goes the wrong way).
  // loose: only the first and last rules (a missed card coming back on time matters more than the others).
  function fitsAt(list, pos, p, from = 0, twin = false, loose = false) {
    const ans = answerOf(p), prev = pos > from ? list[pos - 1] : null, next = list[pos];
    const before = pos > from ? prev?.answer : S.lastAns;
    if (before === ans || next?.answer === ans) return false;
    if (!loose && !twin && before != null && anchorsOf(p).includes(before)) return false;
    if (!loose && next && next.targets.some((t) => t.n === ans)) return false;
    return !(prev?.twin && next?.twin);
  }
  // The place for a missed card coming back, as near `pos` as it fits between lo and hi: there, one later or
  // one earlier; then the same places with the loose rules (see fitsAt); then two later. Without the loose
  // pass about 1 comeback in 10 ran 2 or more cards late (small numbers often share a slip with a neighbour).
  function spotFor(list, pos, p, lo, hi, from = 0) {
    for (const [d, loose] of [[0, false], [1, false], [-1, false], [0, true], [1, true], [-1, true], [2, false], [2, true]]) {
      const q = pos + d;
      if (q >= lo && q <= hi && fitsAt(list, q, p, from, false, loose)) return q;
    }
    return -1;
  }

  // ----- choosing what a wave holds

  function lowerStep() {
    // an earlier step, leaning toward the ones with misses waiting and the ones with the lowest score
    const pool = [];
    for (let k = 1; k < S.step; k++) pool.push(k);
    if (!pool.length) return null;
    const missed = (k) => S.review.filter((r) => r.rung === k).length;
    return pickW(pool, (k) => { const r = rungStat(k); return 1 + Math.min(3, missed(k)) + 2 * (1 - (r.right + 1) / (r.right + r.wrong + 2)); });
  }

  function wave({ count = TARGETS_PER_CARD, cards = CARDS_PER_WAVE } = {}) {
    closeWave();
    const perCard = clampInt(num(count, TARGETS_PER_CARD), 4, 6);
    const nCards = clampInt(num(cards, CARDS_PER_WAVE), 1, 8);
    if (S.lastAt && now() - S.lastAt > SESSION_GAP_MS) newSession();
    S.lastAt = now();
    dealing = 1;

    const warmup = S.warmups > 0 && S.placed && !(steered && steered.placing);
    const placing = !S.placed || !!(steered && steered.placing);
    const list = [];
    const seen = new Set();
    // On the mixed steps, keep the right answers about half positive and half negative, so "it's always
    // negative up here" never becomes a shortcut: each card first picks the sign it aims for (the one that has
    // been behind lately, else either), then deals until it gets it (a zero pair is fine either way).
    const mixedProblem = (rung) => {
      const mixed = LADDER[rung - 1].shapes.length > 2;
      let p = problem(shapeFor(rung), LADDER[rung - 1].max);
      if (!mixed) return p;
      const aim = S.balance >= 0.5 ? -1 : S.balance <= -0.5 ? 1 : R() < 0.5 ? 1 : -1;
      for (let tries = 0; tries < 10; tries++) {
        const ans = p.s + (p.op === '-' ? -p.t : p.t);
        if (ans === 0 || Math.sign(ans) === aim) break;
        p = problem(shapeFor(rung), LADDER[rung - 1].max);
      }
      return p;
    };
    const add = (p, rung, size, extra = {}) => {
      // never the same problem twice in a wave, and it has to fit after the card before (see fitsAt; the first
      // card is checked against the last card of the wave before)
      const ans = answerOf(p);
      if (seen.has(keyOf(p)) || !fitsAt(list, list.length, p, 0, extra.twin && list.length > 0)) return false;
      // a 4-answer card has no room for the pair of one-offs a problem whose wrong way lands on 0 needs (see
      // makeCard): deal another problem instead
      if (size <= 4 && p.s === (p.op === '-' ? -p.t : p.t)) return false;
      seen.add(keyOf(p));
      list.push(cardFor(p, rung, size, { ...extra, after: list.length ? list[list.length - 1].answer : S.lastAns }));
      // the running lean of right answers: + when positives have been ahead lately, − when negatives have
      S.balance = Math.max(-4, Math.min(4, S.balance * 0.7 + Math.sign(ans)));
      S.lastShape = p.shape || S.lastShape;
      return true;
    };

    // Cards that fooled the kid come back where they are due. This session's misses go first, soonest due
    // first; last session's (old) ones after them. A warm-up wave takes back only this session's misses from
    // its own easy steps (up to `top`), so it stays easy.
    const takeBacks = (top) => {
      let backs = 0;
      const queue = [...S.soon.filter((b) => !b.old).sort((a, b) => a.due - b.due), ...S.soon.filter((b) => b.old)];
      for (const b of queue) {
        if (backs >= MAX_BACKS_PER_WAVE) break;
        if (top && (b.old || b.rung > top)) continue;
        // the card at position p is finished as card number clock + p + 1; due is the number it should be
        const pos = Math.min(Math.max(0, b.due - S.clock), list.length);
        if (b.due - S.clock > list.length) continue;
        if (seen.has(keyOf(b))) {
          // this wave already deals the same problem: that card is its comeback
          const twin = list.find((x) => keyOf({ s: x.parts.start, op: x.parts.op, t: x.parts.term }) === keyOf(b));
          if (twin && !twin.twin) { twin.back = true; twin.review = false; backs++; }
          S.soon.splice(S.soon.indexOf(b), 1);
          continue;
        }
        const at = spotFor(list, pos, b, 0, list.length);
        if (at < 0) continue;   // no spot that fits (see fitsAt): it waits for the next wave
        S.soon.splice(S.soon.indexOf(b), 1);
        seen.add(keyOf(b));
        list.splice(at, 0, cardFor(b, b.rung, top ? Math.min(perCard, EASY_TARGETS) : perCard, { back: true, after: at ? list[at - 1].answer : S.lastAns }));
        backs++;
      }
    };

    if (warmup) {
      S.warmups--;
      const top = Math.max(1, S.step - WARMUP_BELOW);
      let guard = 0;
      while (list.length < nCards && guard++ < 40) {
        const rung = pickW(Array.from({ length: top }, (_, i) => i + 1), (k) => (k === top ? 2 : 1));
        add(problem(shapeFor(rung), LADDER[rung - 1].max), rung, Math.min(perCard, EASY_TARGETS));
      }
      takeBacks(top);
    } else {
      const fresh = rungStat(S.step).cards < 3;
      const size = fresh ? Math.min(perCard, EASY_TARGETS) : perCard;
      // the equation twins on the top steps: −a + b and −a − b, one after the other
      if (!placing && S.step >= 6 && nCards >= 2 && R() < TWINS_CHANCE) {
        const max = LADDER[S.step - 1].max;
        // −a − b is always below zero, so when the answers have been leaning negative lately, the other twin
        // (−a + b) is made to land above zero: the pair then adds one of each
        let p = problem('tidy', max);
        for (let tries = 0; tries < 6 && S.balance <= -1 && p.t <= -p.s; tries++) p = problem('tidy', max);
        const first = R() < 0.5 ? '+' : '-';
        // both or neither (a lone card marked as a twin would be a pair with nothing)
        if (add({ ...p, op: first }, S.step, size, { twin: true })) {
          if (add({ ...p, op: first === '+' ? '-' : '+' }, S.step, size, { twin: true })) S.sinceReview += 2;
          else { list.pop().twin = false; seen.delete(keyOf({ ...p, op: first })); }
        }
      }
      let guard = 0;
      while (list.length < nCards && guard++ < 60) {
        let rung = S.step;
        if (!placing && S.step > 1 && S.sinceReview >= REVIEW_EVERY - 1) rung = lowerStep() || S.step;
        const ok = add(mixedProblem(rung), rung, rung === S.step ? size : perCard, rung !== S.step ? { review: true } : {});
        if (ok) S.sinceReview = rung !== S.step ? 0 : S.sinceReview + 1;
      }
      takeBacks(0);
    }

    S.waves++;
    S.cur = { id: S.waves, at: 0, step: S.step, warmup, placing, closed: false, downs: 0, cards: list, nextId: dealing };
    return view();
  }

  // What the game sees of the wave: the card to show now and the rest.
  function view() {
    const c = S.cur;
    if (!c) return null;
    const card = c.cards[c.at] || null;
    const hard = c.cards.reduce((m, x) => Math.max(m, x.rung || 1), 1);
    return {
      id: c.id, kind: 'sum',
      rule: card ? `${card.text} = ?` : '',
      card: card ? publicCard(card) : null,
      cards: c.cards.map(publicCard),
      targets: card ? card.targets.map((t) => ({ ...t })) : [],
      step: S.step, hard,
      fresh: !c.warmup && rungStat(c.step).cards < 3,
      warmup: c.warmup, placing: c.placing, review: c.cards.some((x) => x.review),
      stage: c.warmup || (card && card.targets.length <= EASY_TARGETS) ? 'easy' : 'designed',
    };
  }
  function publicCard(x) {
    return {
      id: x.id, text: x.text, say: x.say, answer: x.answer, parts: { ...x.parts }, shape: x.shape, rung: x.rung,
      targets: x.targets.map((t) => ({ ...t })), back: !!x.back, review: !!x.review, twin: !!x.twin, helped: !!x.helped,
    };
  }
  function card() {
    const c = S.cur;
    if (!c || c.closed) return null;
    const x = c.cards[c.at];
    return x ? publicCard(x) : null;
  }

  // ----- answers

  function remember(x) {
    const old = S.review.find((r) => keyOf(r) === keyOf(x));
    if (old) { old.sess = S.session; old.misses = (old.misses || 1) + 1; }
    else S.review.push({ s: x.s, op: x.op, t: x.t, rung: x.rung, shape: x.shape, sess: S.session, misses: 1 });
    while (S.review.length > REVIEW_KEEP) S.review.shift();
  }

  // After a climb on a first visit, the cards still to come are dealt again at the new step.
  function redealRest() {
    const c = S.cur;
    for (let i = c.at; i < c.cards.length; i++) {
      const x = c.cards[i];
      if (x.back || x.review || x.tried) continue;   // (the card on show, already tried, stays as it is)
      // the card after it stays when it is a comeback or a review card: the new one has to fit before it too
      const keep = c.cards[i + 1] && (c.cards[i + 1].back || c.cards[i + 1].review) ? c.cards[i + 1] : null;
      const before = i > c.at ? c.cards[i - 1].answer : S.lastAns;
      let p;
      for (let tries = 0; tries < 8; tries++) {
        p = problem(shapeFor(S.step), LADDER[S.step - 1].max);
        const ans = answerOf(p);
        if (ans !== before && !anchorsOf(p).includes(before) && !(keep && (keep.answer === ans || keep.targets.some((t) => t.n === ans)))) break;
      }
      c.cards[i] = cardFor(p, S.step, x.targets.length, { into: c, after: i > 0 ? c.cards[i - 1].answer : S.lastAns });
    }
  }

  // n: the number on the target the kid picked. good: whether it was the right one (the target's `good`).
  // id (optional): the id of the card the target belonged to.
  // Returns { right, step, moved (−1, 0 or +1), placed, comeback: null | { text, after }, card, waveDone, first, stale }.
  // card is the card to show now: the same one after a miss (the kid tries again), the next after a right pick.
  // A pick that lands after its card is gone (a second rope after the wave closed, or a target from the card
  // before when `id` is passed) changes nothing and comes back with stale: true; `right` still says whether
  // that target was the right one, so the game doesn't call a good catch a miss.
  function answer(n, good, id) {
    const c = S.cur && !S.cur.closed ? S.cur : null;
    const x = c ? c.cards[c.at] : null;
    const before = S.step;
    if (!x || (id != null && id !== x.id)) {
      const nowCard = x ? publicCard(x) : null;
      return { right: good === true, step: S.step, moved: 0, placed: S.placed, comeback: null, card: nowCard, waveDone: !x, first: false, stale: true };
    }
    const right = typeof good === 'boolean' ? good : n === x.answer;
    const first = !x.tried;
    x.tried = true;
    S.lastAt = now();
    const rs = rungStat(x.rung || 1);
    if (first) rs.cards++;
    let comeback = null;

    if (right) {
      x.done = first ? 1 : 2;
      S.clock++;
      if (first && x.helped) {
        // Right, after the number line came up to help (8 s of thinking, or "Show me") but before any pick.
        // Well done, and the game pays as usual, but it isn't a clean card: it doesn't count toward the 3 in a
        // row for climbing, or toward finding the first step (the streak just waits). Nothing is taken away.
        rs.helped = (rs.helped || 0) + 1;
      } else if (first) {
        rs.right++;
        if (c.warmup || steered) {
          // warm-ups sit below the kid's step; they never move it (nor does anything, once the skill model steers)
        } else if (!S.placed) {
          S.step = Math.min(LADDER.length, S.step + 1);
          if (S.step === LADDER.length) S.placed = true;   // reached the top: nothing left to find
        } else if (REVIEWS_COUNT_UP || (!x.review && !x.back)) {
          S.streak++;
          if (S.streak >= CLEAN_TO_CLIMB) { S.step = Math.min(LADDER.length, S.step + 1); S.streak = 0; }
        }
        // a card from an earlier session answered clean is done with
        if (x.back) {
          const k = keyOf({ s: x.parts.start, op: x.parts.op, t: x.parts.term });
          S.review = S.review.filter((r) => !(keyOf(r) === k && r.sess < S.session));
        }
      }
      // the seen-but-not-picked wrong answers count as "seen" for the slip tally
      for (const t of x.targets) if (!t.good && !t.picked) slipStat(t.trap).seen++;
      S.lastAns = x.answer;
      c.at++;
      if (S.step > before && c.placing) redealRest();
    } else {
      x.misses++;
      if (Number.isInteger(n)) x.lastPick = n;   // "Show me" now replays this pick's picture (see help)
      const t = x.targets.find((y) => y.n === n);
      if (t && !t.good && !t.picked) { t.picked = true; const st = slipStat(t.trap); st.seen++; st.fooled++; }
      if (first) {
        rs.wrong++;
        S.streak = 0;
        const p = { s: x.parts.start, op: x.parts.op, t: x.parts.term, rung: x.rung, shape: x.shape };
        // a returning card from above the kid's step has already been counted once: missing it again moves nothing
        const counts = !steered && !c.warmup && !(x.back && (x.rung || 1) > S.step);
        if (counts) {
          if (!S.placed) {
            // The climb ends here, PLACE_BELOW (2) steps below where the kid is now. (Not below the missed
            // card's own step: when the miss is the comeback of the forgiven slip from a few steps back, that
            // would drop several more steps at once.)
            S.placeMisses++;
            if (S.placeMisses >= PLACEMENT_MISSES) { S.placed = true; S.step = Math.max(1, S.step - PLACE_BELOW); c.downs = MAX_DOWN_PER_WAVE; }
          } else if ((c.downs || 0) < MAX_DOWN_PER_WAVE && S.step > 1) {
            S.step--;
            c.downs = (c.downs || 0) + 1;
          }
        }
        // it comes back 2 to 4 cards later: in this wave if there is room, otherwise in a later one. A card that
        // was already a comeback waits for next session instead, so a hard card can't keep coming round. Either
        // way, any older place in the waiting list for the same problem goes, so it is never lined up twice.
        S.soon = S.soon.filter((s) => keyOf(s) !== keyOf(p));
        if (!x.back) {
          let after = COMEBACK_MIN + Math.floor(R() * (COMEBACK_MAX - COMEBACK_MIN + 1));
          // in this wave: at that spot, or the nearest one that fits (see fitsAt)
          const at = c.at + after <= c.cards.length
            ? spotFor(c.cards, c.at + after, p, c.at + COMEBACK_MIN, Math.min(c.at + COMEBACK_MAX, c.cards.length), c.at)
            : -1;
          if (at >= 0) {
            after = at - c.at;
            c.cards.splice(at, 0, cardFor(p, x.rung, x.targets.length, { back: true, into: c, after: c.cards[at - 1].answer }));
          } else {
            S.soon.push({ ...p, due: S.clock + after });
            while (S.soon.length > SOON_KEEP) S.soon.shift();
          }
          comeback = { text: x.text, after };
        }
        remember(p);
      }
    }
    const nowCard = c.cards[c.at] || null;
    if (!nowCard) closeWave();
    return {
      right, step: S.step, moved: Math.sign(S.step - before), placed: S.placed, comeback,
      card: nowCard ? publicCard(nowCard) : null, waveDone: !nowCard, first, helped: !!x.helped,
    };
  }

  // Close the current wave (wave() does this itself).
  function closeWave() {
    if (S.cur && !S.cur.closed) S.cur.closed = true;
  }

  // ----- words and pictures for the kid

  const asCard = (c) => (c && c.parts ? c : card());

  // explain(card, picked) or explain(picked) for the card showing now.
  // -> { slip, line, numberLine: { start, change, result, op, term, reason, picked } }
  function explain(c, picked) {
    if (typeof c === 'number') { picked = c; c = null; }
    c = asCard(c);
    if (!c) return null;
    const { slip, line } = explainPick(c, picked);
    const p = c.parts;
    return {
      slip, line, good: picked === c.answer,
      numberLine: { start: p.start, change: p.change, result: c.answer, op: p.op, term: p.term, reason: line, picked: picked === c.answer ? null : picked, reveal: true },
    };
  }

  // help(card): the number line for a kid who is stuck (after 8 s, or on "Show me"): the answer stays hidden.
  // On a card the kid has already missed, the answer has been shown, so "Show me" brings back that same
  // picture (the answer, her pick and the reason) instead of hiding it again.
  function help(c) {
    c = asCard(c);
    if (!c) return null;
    const live = S.cur && !S.cur.closed ? S.cur.cards[S.cur.at] : null;
    if (live && live.id === c.id && live.misses > 0 && Number.isInteger(live.lastPick)) return { ...explain(c, live.lastPick).numberLine, again: true };
    // before any pick: the card counts as helped (a right pick after this pays, but doesn't count toward
    // climbing; see answer)
    if (live && live.id === c.id && !live.tried) live.helped = true;
    const p = c.parts;
    return { start: p.start, change: p.change, op: p.op, term: p.term, reveal: false, reason: nudge(c) };
  }

  function hint(c) {
    c = asCard(c);
    return c ? nudge(c) : 'Adding goes UP the number line, taking away goes DOWN. Taking away a negative turns around and goes UP.';
  }

  // ----- for parents and dev tools

  function level() {
    const r = LADDER[S.step - 1];
    return {
      step: S.step, of: LADDER.length, label: r.label, placing: !S.placed,
      line: `Step ${S.step} of ${LADDER.length}: ${r.label}${S.placed ? '' : ', still finding the starting step'}`,
    };
  }

  function report() {
    return {
      level: level(), sessions: S.session, waves: S.waves, cards: S.clock,
      steps: Object.keys(S.rungs).sort((a, b) => a - b).map((k) => ({ step: Number(k), ...S.rungs[k] })),
      slips: Object.fromEntries(Object.entries(S.slips).map(([k, v]) => [k, { seen: v.seen, fooled: v.fooled }])),
      missed: S.review.map((r) => problemText(r.s, r.op, r.t)),
    };
  }

  // Dev shortcut: jump to a step (counts as placed, so it stays put until the answers move it).
  function setStep(step) {
    S.step = clampInt(num(step, 1), 1, LADDER.length);
    S.placed = true; S.streak = 0; S.warmups = 0;
  }
  // The rider's skill model (src/math/skill.js) picks the step from here on (as the card trainer's steer in early.js):
  // the trainer's own climb, first-visit placement and steps down stop; placing: the strand is still finding its level
  // (no warm-ups, review cards or twins). A new step while a wave is open deals its cards still to come again at it.
  let steered = null;
  function steer(step, { placing = false } = {}) {
    const was = S.step;
    S.step = clampInt(num(step, 1), 1, LADDER.length);
    if (!steered) { S.placed = true; S.streak = 0; S.placeMisses = 0; }
    steered = { placing: !!placing };
    const c = S.cur;
    if (c && !c.closed && !c.warmup && S.step !== was) { redealRest(); c.step = S.step; }
    return S.step;
  }

  if (opts.newSession || !S.lastAt || now() - S.lastAt > SESSION_GAP_MS) newSession();

  return {
    topic: 'negatives', name: 'Positive & negative', state: S,
    wave, card, answer, explain, help, hint, level, report, setStep, steer, newSession,
    get steered() { return !!steered; },
    endWave: closeWave,
    due: () => [],   // missed cards come back inside the wave's own list (see answer()), so there is nothing extra to hand out
  };
}
