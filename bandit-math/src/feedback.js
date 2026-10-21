// feedback.js: what the game sends home to help make it better, all of it anonymous and all of it optional.
//
//   - a thumbs up or down when a job ends ("rate"), a question flagged as confusing ("question"), a note from the
//     pause menu's "Tell us" ("tell"), or the maker's own notes ("note", when the game was opened with ?maker)
//   - play events ("events"), only while the "share play data" switch is on: jobs started and finished, each answer
//     (its strand, the point it was asked at, right or not, how long it took), level changes, a session start (phone or
//     computer, the quality tier) and the frame rate once a minute. No names and no typed words in these.
//
// Who sent it is a random device id kept in this browser (never a name; riders go by their number on the title).
// Everything here is wrapped so that it never throws and never holds up a frame: a post that fails, a full queue, a
// browser that is offline, storage that is blocked or a "slow down" (429) from the server are all dropped quietly.
//
//   const F = makeFeedback({ fetch, storage, host, now, every, webdriver, force, onPageHide })   (the parts a test swaps)
//   F.device                 the random id                F.ver   the version tag sent with every post
//   F.sharing() / F.setSharing(on)   the switch           F.maker() / F.setMaker(on)   maker notes on this device
//   F.send(kind, data)       one post now (rate, question, tell, note); -> true when it went off
//   F.event(type, fields)    a play event, queued while sharing; sent in batches every 30 s and when the page is hidden
//   F.flush()                send the queued events now
//   F.answered(a)            one recorded answer ({ strand, at, right, ms, level, before, placed, justPlaced }; also:
//                            true for another strand the same answer counts in: only its level is looked at)
//   F.recent(ms)             the answers recorded in the last ms milliseconds (for a flagged question's "picked")
//   F.jobStart(id) / F.jobEnd(id)   a job in focus started or finished (an answer in a new job starts it by itself)
//   F.context                a function the game sets: () => ({ job, rider, tier, fps, state }) for the events
//   F.state()                for rigs and tests: { device, sharing, queued, sent, dropped, maker }
//
// The default instance (FB, below) is made with the browser's own parts. A browser run by a test rig
// (navigator.webdriver) posts nothing unless the address has ?fbsend, so headless runs never fill the table.

export const ENDPOINT = 'https://rbyyyb4mf4ac26ndwre7fohx3e0xtzlj.lambda-url.us-west-2.on.aws/';
// Share play data starts on for the family's own copy of the game; a public build (itch.io, say) sets this false and
// the switch starts off everywhere.
export const SHARE_DEFAULT = true;
export const SHARE_HOSTS = ['math-games.jconra.com', '127.0.0.1'];
export const FEEDBACK = {
  batchMs: 30000,     // play events go in one post every 30 s
  fpsMs: 60000,       // a frame-rate sample a minute
  maxQueue: 400,      // events kept waiting at most (the oldest go first)
  maxPerPost: 150,    // events in one post (the server keeps 200 in a list)
  maxBytes: 12000,    // the size of one post kept under the server's 16 KB
  backoffMs: 60000,   // after a 429, nothing is sent for a minute
  recentMs: 180000,   // the answers kept for a flagged question (3 minutes)
};
const KEY = { device: 'bm-fb-device', share: 'bm-fb-share', maker: 'bm-fb-maker' };
export const KINDS = ['tell', 'rate', 'question', 'note', 'events'];

function randomId(n = 20) {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  try {
    const c = globalThis.crypto;
    if (c && c.getRandomValues) { const a = c.getRandomValues(new Uint8Array(n)); for (const b of a) s += abc[b % abc.length]; return s; }
  } catch (e) { /* (no crypto: Math.random below) */ }
  for (let i = 0; i < n; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}
const r1 = (v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);

export function makeFeedback({ fetch: fetchFn = null, storage = null, host = '', now = () => Date.now(), every = null,
  webdriver = false, force = false, version = '', endpoint = ENDPOINT, online = () => true } = {}) {
  const get = (k) => { try { return storage ? storage.getItem(k) : null; } catch (e) { return null; } };
  const set = (k, v) => { try { if (!storage) return; if (v == null) storage.removeItem(k); else storage.setItem(k, v); } catch (e) { /* (storage blocked) */ } };

  let device = get(KEY.device);
  if (!device || !/^[A-Za-z0-9_-]{8,40}$/.test(device)) { device = randomId(); set(KEY.device, device); }
  const session = randomId(10), born = now();
  const shareDefault = SHARE_DEFAULT && SHARE_HOSTS.includes(host);
  const quiet = webdriver && !force;   // (a test rig's browser: nothing is posted)
  let queue = [], sent = 0, dropped = 0, holdUntil = 0, posts = 0;
  const recent = [];
  let job = null, jobAt = 0, jobN = 0, jobRight = 0;

  const F = {
    device, session, ver: String(version || 'dev').slice(0, 40), context: () => ({}),
    sharing() { const v = get(KEY.share); return v === '1' ? true : v === '0' ? false : shareDefault; },
    setSharing(on) { set(KEY.share, on ? '1' : '0'); if (!on) queue = []; },
    maker() { return get(KEY.maker) === '1'; },
    setMaker(on) { set(KEY.maker, on ? '1' : null); },
  };
  const ctx = () => { try { return F.context() || {}; } catch (e) { return {}; } };

  // one post: JSON as plain text (a "simple" request: no preflight); keepalive lets it finish as the page goes
  function post(kind, data) {
    try {
      if (quiet || !fetchFn || now() < holdUntil || !online()) { dropped++; return false; }
      const body = JSON.stringify({ kind, device, ver: F.ver, data });
      if (body.length > 15500) { dropped++; return false; }
      posts++;
      // (no-cors: the server's answer can't be read, so a blocked read never shows as an error on the page; the post
      // itself goes through. A 429 is still heeded where it can be seen: a test's fetch, or a server that allows reading)
      const p = fetchFn(endpoint, { method: 'POST', body, keepalive: true, mode: 'no-cors', credentials: 'omit',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' } });
      if (p && typeof p.then === 'function') {
        p.then((r) => { if (r && r.status === 429) holdUntil = now() + FEEDBACK.backoffMs; else if (r && (r.ok || r.type === 'opaque')) sent++; }, () => { dropped++; });
      }
      return true;
    } catch (e) { dropped++; return false; }
  }

  F.send = (kind, data = {}) => {
    if (!KINDS.includes(kind) || kind === 'events') return false;
    try {
      const c = ctx();
      return post(kind, { rider: c.rider ?? null, tier: c.tier ?? null, ...data });
    } catch (e) { return false; }
  };

  F.event = (type, fields = {}) => {
    try {
      if (!F.sharing()) return false;
      queue.push({ t: Math.round((now() - born) / 1000), type, ...fields });
      if (queue.length > FEEDBACK.maxQueue) { dropped += queue.length - FEEDBACK.maxQueue; queue.splice(0, queue.length - FEEDBACK.maxQueue); }
      return true;
    } catch (e) { return false; }
  };

  // the queue in posts of at most maxPerPost events and maxBytes bytes each
  F.flush = () => {
    try {
      if (!queue.length) return 0;
      if (!F.sharing()) { queue = []; return 0; }
      const c = ctx(), head = { sess: session, rider: c.rider ?? null };
      let n = 0;
      while (queue.length) {
        let k = Math.min(queue.length, FEEDBACK.maxPerPost);
        while (k > 1 && JSON.stringify(queue.slice(0, k)).length > FEEDBACK.maxBytes) k = Math.ceil(k / 2);
        const part = queue.splice(0, k);
        if (post('events', { ...head, list: part })) n++;
      }
      return n;
    } catch (e) { queue = []; return 0; }
  };

  // ── answers, levels, jobs ────────────────────────────────────────────────────────────────────────────────────
  F.jobStart = (id) => {
    if (!id || id === job) return;
    if (job) F.jobEnd(job, 'switch');
    job = id; jobAt = now(); jobN = 0; jobRight = 0;
    F.event('job', { job: id, go: 'start' });
  };
  F.jobEnd = (id = job, why = 'done') => {
    if (!job || (id && id !== job)) return null;
    const out = { job, answers: jobN, right: jobRight, secs: Math.round((now() - jobAt) / 1000) };
    F.event('job', { ...out, go: 'end', why });
    job = null;
    return out;
  };
  F.job = () => job;
  F.answered = (a) => {
    try {
      if (!a || !a.strand) return;
      const t = now(), c = ctx();
      if (a.also) { levelMoved(a); return; }   // (another strand the same answer counts in: only its level)
      const one = { strand: a.strand, pct: r1(a.at), right: !!a.right, ms: Number.isFinite(a.ms) ? Math.round(a.ms) : null };
      recent.push({ ...one, job: c.job || null, at: t });
      while (recent.length && t - recent[0].at > FEEDBACK.recentMs) recent.shift();
      if (recent.length > 40) recent.splice(0, recent.length - 40);
      if (c.job && c.job !== job) F.jobStart(c.job);
      if (job) { jobN++; if (a.right) jobRight++; }
      F.event('answer', { ...one, job: c.job || null });
      levelMoved(a);
    } catch (e) { /* (a measurement never gets in the way) */ }
  };
  // a level change: the level crossed a 5-point band, or the strand just found its level
  function levelMoved(a) {
    if (Number.isFinite(a.level) && Number.isFinite(a.before) && (a.justPlaced || Math.floor(a.level / 5) !== Math.floor(a.before / 5))) {
      F.event('level', { strand: a.strand, from: r1(a.before), to: r1(a.level), placed: !!a.placed, found: !!a.justPlaced });
    }
  }
  F.recent = (ms = FEEDBACK.recentMs) => { const t = now(); return recent.filter((x) => t - x.at <= ms).map(({ at, ...x }) => x); };
  F.last = () => (recent.length ? recent[recent.length - 1] : null);

  F.state = () => ({ device, session, sharing: F.sharing(), queued: queue.length, sent, posts, dropped, maker: F.maker(), quiet, job });
  F.queued = () => queue.slice();

  if (typeof every === 'function') { try { every(() => F.flush(), FEEDBACK.batchMs); } catch (e) { /* (no timers) */ } }
  return F;
}

// ── THE GAME'S OWN ───────────────────────────────────────────────────────────────────────────────────────────────
function browserFeedback() {
  const g = globalThis;
  let storage = null; try { storage = g.localStorage || null; } catch (e) { storage = null; }
  let q = null; try { q = new URLSearchParams(g.location ? g.location.search : ''); } catch (e) { q = null; }
  // the version: the build number in the page's main.js?v=N (index.html bumps it with every release)
  let version = 'dev';
  try {
    const s = g.document && g.document.querySelector('script[src*="main.js"]');
    const m = s && /[?&]v=([\w.-]+)/.exec(s.getAttribute('src'));
    if (m) version = 'v' + m[1];
  } catch (e) { /* (no page) */ }
  const F = makeFeedback({
    fetch: typeof g.fetch === 'function' ? g.fetch.bind(g) : null,
    storage,
    host: (g.location && g.location.hostname) || '',
    webdriver: !!(g.navigator && g.navigator.webdriver),
    force: !!(q && q.has('fbsend')),
    online: () => !(g.navigator && g.navigator.onLine === false),
    version,
    every: (fn, ms) => { if (typeof g.setInterval === 'function') g.setInterval(fn, ms); },
  });
  // ?maker remembers maker notes on this device; ?maker=0 forgets
  try { if (q && q.has('maker')) F.setMaker(q.get('maker') !== '0'); } catch (e) { /* (no address) */ }
  // the page going away (or hidden: a phone's tab switched) sends what is queued; keepalive lets the post finish
  try {
    g.addEventListener('pagehide', () => F.flush());
    g.addEventListener('visibilitychange', () => { if (g.document && g.document.visibilityState === 'hidden') F.flush(); });
  } catch (e) { /* (no page) */ }
  return F;
}

const noop = () => null;
let made = null;
try { made = typeof globalThis.window !== 'undefined' ? browserFeedback() : null; } catch (e) { made = null; }
// (outside a browser, or if anything above failed: a stand-in that does nothing)
export const FB = made || { device: '', session: '', ver: '', context: noop, sharing: () => false, setSharing: noop, maker: () => false,
  setMaker: noop, send: () => false, event: () => false, flush: () => 0, jobStart: noop, jobEnd: noop, job: noop, answered: noop,
  recent: () => [], last: noop, state: () => ({}), queued: () => [] };
