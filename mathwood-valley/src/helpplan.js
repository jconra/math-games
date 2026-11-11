// helpplan.js: THE HELP BUTTON's rules, as plain functions (src/ui/helpmenu.js draws the button and its menu; node
// tests drive these). The game's maker (2026-11-10): "Maybe the confusing button should just be a permanent help button
// and if a question is currently up then that fills into a spot on the report form. If no question is up, like the
// windmill, it would just show windmill, and possibly even some information about their build ... So there is always a
// ? in the top corner ... The question mark could start gaining attention if someone seems stuck (throbbing or a
// spinning arc). With the help menu up it could show what Hob is saying for advice, an example question, an option to
// skip to a new question, the feedback form, and the links."
//
//   STUCK                       the "seems stuck" table (below)
//   makeStuckWatch(table)       -> W: W.answered(kind, right), W.tick(secs, { asking, building, progress }),
//                                  W.opened(), W.on (true while the "?" draws attention), W.why ('wrong' | 'waiting' |
//                                  'build' | null), W.state()
//   HOWTO, videoOf(job, how), howtoLink(job, how)   the how-to videos: one for each job (empty until uploaded)
//   SKIP_LINE, skipLine(job), SKIP_WHY, skipWhy(job)   the skip's line in the menu, and why a job can't skip just then
//   clockText(secs)             754 -> '12:34'
//   buildSummary(job, b)        a short plain line about a build (the windmill's, the bridge's, the dock's)
//   reportOf({ q, job, summary, build, note, place, tier })   what the help menu's form sends (feedback.js 'question')
//   sectionsFor(ctx)            which parts the menu shows, in order, and which start open
//   LINKS                       External Links (none yet: the game's maker, 2026-11-10, "hold off for now")
//   videoJob(job)               the job id the video table knows for a job id the game uses

// ── SEEMS STUCK ─────────────────────────────────────────────────────────────────────────────────────────────────────
// The "?" draws attention, gently (a slow pulse round it: never a flash), when any of these is true. It stops
// when the help menu is opened, a question is answered right, a builder moves on, or the question goes away.
export const STUCK = {
  wrongInRow: 3,    // wrong answers in a row on the same kind of question (the same strand)
  askedSecs: 45,    // seconds with a question up and no answer at all (counted only while the game runs)
  buildSecs: 60,    // seconds at a builder (the windmill, the bridge) with nothing added, taken down or answered
};

export function makeStuckWatch(T = STUCK) {
  let streak = 0, kind = null, askT = 0, buildT = 0, buildKey = undefined, why = null;
  const light = (w) => { if (!why) why = w; };
  const W = {
    get on() { return !!why; },
    get why() { return why; },
    // an answer: right puts the light out and starts every count again; wrong counts toward the streak
    answered(k, right) {
      askT = 0;
      if (right) { streak = 0; kind = null; why = null; buildT = 0; return false; }
      streak = k != null && k === kind ? streak + 1 : 1; kind = k == null ? null : k;
      if (streak >= T.wrongInRow) light('wrong');
      return !!why;
    },
    // time passing while the game runs: asking (a question up), building (a builder up) and its progress (anything
    // that changes when the build moves on: the board count, say)
    tick(secs, { asking = false, building = false, progress = null } = {}) {
      const dt = Number.isFinite(secs) && secs > 0 ? secs : 0;
      if (asking) { askT += dt; if (askT >= T.askedSecs) light('waiting'); } else { askT = 0; if (why === 'waiting') why = null; }
      if (building) {
        if (progress !== buildKey) { const moved = buildKey !== undefined; buildKey = progress; buildT = moved ? 0 : dt; if (moved && why === 'build') why = null; }
        else { buildT += dt; if (buildT >= T.buildSecs) light('build'); }
      } else { buildT = 0; buildKey = undefined; if (why === 'build') why = null; }
      // (left the job: no question and no builder up any more; a wrong streak's light goes out too)
      if (!asking && !building && why === 'wrong') { why = null; streak = 0; kind = null; }
      return !!why;
    },
    // the help menu opened: the light goes out and every count starts again
    opened() { why = null; streak = 0; kind = null; askT = 0; buildT = 0; },
    state: () => ({ on: !!why, why, streak, kind, askSecs: Math.round(askT * 10) / 10, buildSecs: Math.round(buildT * 10) / 10 }),
  };
  return W;
}

// ── THE HOW-TO VIDEOS ───────────────────────────────────────────────────────────────────────────────────────────────
// One short video for each job, each starting at the jobs board (the game's maker, 2026-11-10: a separate video per
// job, not one long one with chapters). A job's "?" shows its own video's thumbnail and opens it in a new tab; a job
// with no video shows no video part. After uploading one, fill in its job:
//   windmill: { id: 'abcdefghijk' }                 the 11 letters after youtu.be/
//   windmill: { id: 'abcdefghijk', start: 12 }      ...opening 12 seconds in (optional)
//   windmill: { id: 'abcdefghijk', length: 165 }    ...its length in seconds (optional: only for the thumbnail's bar)
export const HOWTO = {
  roundup: null, sheep: null, pigs: null, store: null, delivery: null, wagon: null, deer: null, range: null, loot: null,
  windmill: null, bridge: null, fishing: null, boxes: null, graphs: null,
};
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
// the video table's job for a job id the game uses (selling goods is the store's counter; a builder's own ids are the jobs')
export const videoJob = (job) => (job === 'sell' ? 'store' : job === 'build' ? null : job || null);
// a job's video: { id, start (seconds, or null), length (seconds, or null), link }, or null (none yet, or not a real id)
export function videoOf(job, how = HOWTO) {
  const v = how && videoJob(job) ? how[videoJob(job)] : null;
  if (!v || !VIDEO_ID.test(String(v.id || ''))) return null;
  const start = Number.isFinite(v.start) && v.start > 0 ? Math.round(v.start) : null;
  const length = Number.isFinite(v.length) && v.length > 0 ? Math.round(v.length) : null;
  return { id: v.id, start, length, link: `https://youtu.be/${v.id}${start ? `?t=${start}` : ''}` };
}
export const howtoLink = (job, how = HOWTO) => { const v = videoOf(job, how); return v ? v.link : null; };
export function clockText(secs) {
  const s = Math.max(0, Math.round(Number(secs) || 0)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

// ── SKIP: THE MENU'S LINES ──────────────────────────────────────────────────────────────────────────────────────────
// Under the skip button: what a skip does here.
export const SKIP_LINE = {
  default: 'You get a new one, a little easier. No harm done.',
  sell: 'Ezra offers you a different deal. Your goods stay yours. No harm done.',
  wagon: 'This gang rides off and a new one rides in, a little easier. The ones you roped still count.',
  delivery: 'A new order for the same camp, a little easier, from its first step. No harm done.',
  loot: 'This bundle is shared out another way, a little easier. No harm done.',
};
// When a job can't swap the question just then, one plain, kind line why (the menu says it in place of skipping).
export const SKIP_WHY = {
  default: "This one can't be swapped just this second. Try again in a moment.",
  store: "Ezra is busy with the coins or your working is open. Try again in a moment.",
  sell: "Ezra is busy with the coins, or he has no other deal for what you carry. Try again in a moment.",
  delivery: 'The order can be swapped while its slip is up. Close your working first, then try again.',
  loot: "The families are taking their share right now. You can skip the next bundle.",
  wagon: 'No gang is riding right now. The next one rides in soon.',
  range: 'Miss Opal is setting up the next card. It comes in a moment.',
  deer: 'The picture is being taken. A new question comes right after.',
  windmill: "This card can't be swapped while the miller is teaching, or after you got it right. Press Back to building.",
  bridge: "This card can't be swapped while the engineer is teaching, or after you got it right. Press Back to building.",
  fishing: 'This fish is answered already. Keep it or throw it back, and the next fish brings a new question.',
  boxes: "This box can't be swapped while it is opening, or when it's the storekeeper's own sum. Finish it, or press Done for now.",
  graphs: "The Professor is between points. Try again in a moment.",
  roundup: 'This bunch is done. The next one comes at your level.',
  sheep: 'This flock is done. The next one comes at your level.',
  pigs: 'This batch is done. The next one comes at your level.',
};
export const skipWhy = (job) => SKIP_WHY[job] || SKIP_WHY.default;
export const skipLine = (job) => SKIP_LINE[job] || SKIP_LINE.default;

// ── A BUILD, IN WORDS ───────────────────────────────────────────────────────────────────────────────────────────────
// b (what main.js reads from the builder up, all optional):
//   windmill: { boards, height (ft), W, D (the base, ft), full (full boards left), best (ft stood), mins, done (ft) }
//   bridge:   { boards, deck (laid), planks, carries (the heaviest load it has carried, in words, or null), next, mins }
//   fishing:  { kept, back, stringer, record (in words), mins }
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
export function ftIn(ft) {
  const v = Math.max(0, Number(ft) || 0), inch = Math.round(v * 12), f = Math.floor(inch / 12), i = inch % 12;
  return i ? `${f} ft ${i} in` : `${f} ft`;
}
function spent(mins) {
  if (!Number.isFinite(mins) || mins < 0.5) return null;
  return mins < 1.5 ? 'about a minute at it this time' : `about ${plural(Math.round(mins), 'minute')} at it this time`;
}
export function buildSummary(job, b = {}) {
  b = b || {};
  const out = [];
  if (job === 'windmill') {
    const n = Math.max(0, Math.round(b.boards || 0));
    if (!n) out.push(`The windmill: no boards up yet${b.W && b.D ? `, the stones set ${+b.W} × ${+b.D} ft` : ''}`);
    else {
      out.push(`The windmill: ${plural(n, 'board')} up, ${ftIn(b.height)} tall${b.W && b.D ? ` on a ${+b.W} × ${+b.D} ft base` : ''}`);
      const done = b.done || 18, h = Number(b.height) || 0;
      out.push(h >= done ? `tall enough to finish it (${done} ft)` : `${Math.round(Math.min(1, h / done) * 100)}% of the way to ${done} ft`);
    }
    if (Number.isFinite(b.best) && b.best > 0) out.push(`best stood in the wind: ${ftIn(b.best)}`);
    if (Number.isFinite(b.full)) out.push(`${plural(Math.max(0, Math.round(b.full)), 'full board')} left`);
  } else if (job === 'bridge') {
    const n = Math.max(0, Math.round(b.boards || 0));
    out.push(n ? `The bridge: ${plural(n, 'board')} up` : 'The bridge: no boards up yet');
    if (n) out.push(b.deck ? `the deck laid${Number.isFinite(b.planks) && b.planks > 0 ? ` (${plural(b.planks, 'plank')})` : ''}` : 'no deck yet');
    if (b.carries) out.push(`it has carried a ${b.carries}${b.next ? `; next: a ${b.next}` : ''}`);
    else if (n) out.push('not tested with a load yet');
  } else if (job === 'fishing') {
    const k = Math.max(0, Math.round(b.kept || 0));
    out.push(`Fishing: ${plural(k, 'fish', 'fish')} kept${Number.isFinite(b.back) && b.back > 0 ? `, ${b.back} thrown back` : ''}`);
    if (b.record) out.push(`best: ${b.record}`);
  } else {
    out.push(b.name ? String(b.name) : 'No question up just now');
  }
  const t = spent(b.mins); if (t) out.push(t);
  return out.join('; ') + '.';
}

// ── WHAT THE FORM SENDS ─────────────────────────────────────────────────────────────────────────────────────────────
// The same as the old "Confusing?" chip's mark (src/ui/flag.js gather: job, strand, pct, step, text, choices, picked,
// right, hint, place, tier) and its note, sent the same way (feedback.js FB.send('question', ...)), so the flagged
// question records read the same. via: 'help' says it came from the help menu. With no question up (a builder, riding
// about): the job, the build's summary as the text, and the build's numbers.
const cap = (t, n) => { const s = String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
export function reportOf({ q = null, job = null, summary = null, build = null, note = '', place = null, tier = null } = {}) {
  const words = cap(note, 300) || null;
  if (q && typeof q === 'object') return { ...q, job: q.job || job || null, note: words, via: 'help' };
  return { job: job || null, strand: null, pct: null, step: null, text: cap(summary || 'No question up', 900), choices: null, picked: null, right: null,
    hint: null, place: place || null, tier: tier || null, build: build && typeof build === 'object' ? build : null, note: words, via: 'help' };
}

// ── THE MENU'S PARTS ────────────────────────────────────────────────────────────────────────────────────────────────
// In this order. The big ones fold (an example, the form, the links); only Hob's advice starts open.
//   ctx: { hob (anything to say), example (an example to show), skip (a question is up and this job can deal a new
//          one), report (always: the form), video (a link, or null: hidden), links ([...] External Links) }
export const LINKS = [];   // External Links: { name, url, line } each (none yet: the game's maker said hold off)
export function sectionsFor(ctx = {}) {
  const out = [];
  out.push({ id: 'hob', open: true });
  if (ctx.example) out.push({ id: 'example', open: false, fold: true });
  if (ctx.skip) out.push({ id: 'skip' });
  out.push({ id: 'report', open: false, fold: true });
  if (ctx.video) out.push({ id: 'video' });
  if (Array.isArray(ctx.links) && ctx.links.length) out.push({ id: 'links', open: false, fold: true });
  return out;
}

// a plain "a op b" in an example's words, for Work it out (src/ui/tools.js workOn): '38 + 25' -> { op: 'add', a, b }
const OPS = { '+': 'add', '−': 'sub', '-': 'sub', '×': 'mul', 'x': 'mul', '*': 'mul', '÷': 'div', '/': 'div' };
export function sumIn(text) {
  const m = /(?:^|[^\d.,])(\d{1,6}(?:\.\d{1,3})?)\s*([+−\-×x*÷/])\s*(\d{1,6}(?:\.\d{1,3})?)(?![\d.])/.exec(String(text || '').replace(/,(?=\d{3})/g, ''));
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[3]), op = OPS[m[2]];
  if (!op || !Number.isFinite(a) || !Number.isFinite(b) || (op === 'div' && b === 0)) return null;
  if (op === 'sub' && b > a) return null;   // (Work it out's columns take the bigger number first)
  return { op, a, b };
}
