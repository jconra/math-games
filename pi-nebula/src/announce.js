// THE STATION'S ANNOUNCEMENTS: a calm voice over the speakers, a soft chime first, about once a minute, so the station
// feels alive. The game's maker (2026-11-19): "There could be paging, like "Captain Vega, please report to the control
// room". Or pages like you might here in a hospital to report to the scanner. There could be announcements about
// discoveries made "Captain .... is looking for crew for an urgent medical mission". There could be announcements about
// generic stuff like a shift change. Or that a new Mathball high score has been achieved. You could give me ideas too.
// It will just feel more alive with announcements." Of "Please keep the hangar floor clear": "the announcement might be
// targeted just to that hanger, not to the whole station". "There could be an announcement about high radiation levels
// and not to EVA". The voice: the saved Station Voice "with a little reverb". "Can we have a word bank to make the
// announcements more flexible (switch copper with titanium, or burrito for sandwich)?" Of pages joined from a name and
// a place: "Those joins sound perfect". "I like the chime in the announcements." And: "I was thinking the announcements
// would play about every minute... I don't really see a problem with them playing when you are doing math, maybe just
// half volume."
//
// SO:
//   - ABOUT ONE A MINUTE: the next begins 45 to 75 seconds after the last one ends (ANNOUNCE.every), so it never ticks
//     like a clock; the first comes 25 to 40 seconds after the crew member wakes. Something happening (below) is said
//     as it happens, once the one playing has ended, and the minute is counted again from it.
//   - THE CHIME FIRST, EVERY TIME, then the voice (as sample A with its chime: the voice starts as the chime's file ends).
//   - WHERE IT IS HEARD: a line is for the whole station, or for ONE PLACE only (a room of the station file, by its id:
//     'hangar-miner'), heard by whoever is there. Where the player hears from is where the camera is, the ears of every
//     sound in the game (sound.ears). Inside a ship parked in a hangar is in that hangar (a ship's own room is "with"
//     its hangar in the station file). NOT HEARD away from the station: out at the rocks and in the wormhole (the
//     station is not drawn: W.alone), or anywhere outside the station's rooms (a ship flown outside). Walking out of
//     a hangar while its line plays, it goes quiet; walking back in, it is heard again.
//   - HALF VOLUME while a question card is up (any job's card, and Mathball's screen): "when you are doing math".
//   - The game's sound switch and volume rule over it all (src/sound.js; heard through its own group, 'station').
//   - TRUE WHERE THE GAME KNOWS (LINES below, each line's `say`): the news (news.js: a planet found, a haul, a rescue,
//     each said once, with the very planet or metal the news has), a captain's offer (only while that captain is still
//     asking this crew member, and "see her in the terminal" only while she is in the terminal), the scanner's page
//     (the medic paged as a patient's scan begins: people.js SCAN), a Mathball match (as the player starts one), a ship
//     coming in (the flown Miner crossing into its own hangar from outside: heard in that hangar), the alarm in another
//     ship's hangar (visit.js: heard in that hangar). The rest are the station's everyday lines.
//   - THE WORD BANK: a page is a name and a place said separately and joined at the page's own pauses, as sample E was
//     (PAGE: any name with any place); a word inside a sentence (the metal, the planet, the food left somewhere, the
//     lunch special) is a whole sentence for each word, a handful each: those lines are one group, so the station
//     does not say "Whoever left a..." twice in ten minutes.
//   - TEXT LINES: a line no recorded clip says (the run's own facts: how many people a rescue brought home, from where)
//     is the chime and then its words, shown at the top of the screen for as long as they take to read (TEXT), heard
//     where a spoken line would be (the brief for the rescue's news: "only text lines if a clip doesn't exist; never
//     browser speech"), never while a question card is up (it waits for the card to go; a card come up puts it away). One so far: THE RESCUE'S OUTCOME ('rescued', src/wardplan.js outcome), said once after the
//     recorded "The Medic has brought a stranded crew home safely" for a rescue the crew member was on: "News from the
//     Medic. Five people have been brought home from a crashed ship on a canyon world. They are resting in the ward."
//     And THE EXPLORER'S FINDINGS ('found', src/exploreplan.js findNews), but for a new world, whose recorded line names it:
//     "News from the Explorer. Captain Vega's crew has found a rich asteroid field past the edge of the charts."
//   - THE MATHBALL HIGH SCORE (2026-11-20, the game's maker: "Keep only your own best round. This plays when you beat
//     it."): "A new Mathball high score has been set in the arena." is said once a round is over that beat the crew
//     member's own best round (src/mathball/best.js: their first round only sets it). Mathball tells it as it happens:
//     happened('best').
//
// The clips: assets/sound/station/<id>.mp3, small and mono, all at one loudness (how they were made, and checked by
// speech-to-text: ~/pw/space-math/rigs/announce-1/make.py, check.py). Each is fetched only when its line is about to be
// said (the chime and the lines that happen of a sudden once play begins), never while the station loads.
//
//   const A = makeAnnounce({ sound, W, visit, people, crew })     (src/main.js)
//   A.update(dt, playing)      each frame, after the camera is set (playing: a crew member walking the station)
//   A.say(id)                  a line said as if it had just happened (the rigs); A.next(s): the next minute's turn in s
//                              seconds (the rigs); A.log: every announcement made
//   A.state()                  for the rigs: what is playing, where it is heard from, its volume now
// The rules alone, with no game (node tests): makeAnnouncer({ sound, read }), where read() gives the facts each frame.
import { news } from './news.js';
import { missions } from './missions.js';
import { outcome } from './wardplan.js';

export const ANNOUNCE = {
  first: [25, 40],      // s after the crew member wakes, the first
  every: [45, 75],      // s from the end of one to the start of the next
  volume: 0.55,         // the voice's volume (the people's voices nearby are about as loud)
  math: 0.5,            // times that, while a question card is up
  again: 600,           // s before a line, or a line of the same group, is said again
  wait: 15,             // s something that happened may wait to be said (for the one playing to end, for its clips)
  settle: 0.4,          // s the ears must be in a room before it is where they are
  retry: 5,             // s before trying again when nothing could be said (away, or nothing true)
  chime: 2.51,          // s: the voice starts as the chime's file ends
};
// a text line's words, shown from the chime's end: for as long as they take to read (s, at most `most`)
export const TEXT = { least: 4, per: 0.06, most: 11 };
export const readSecs = (w) => Math.min(TEXT.most, Math.max(TEXT.least, 1.5 + String(w || '').length * TEXT.per));
// a page joined from parts, as sample E: the name, 0.22 s, "please report to the X.", 0.85 s, the name, 0.2 s,
// "to the X."; each part starts where the one before it stops speaking (its `len`) and its pause; the first 0.15 s
// after the chime (the lead a whole line has in its own file)
export const PAGE = { gaps: [0.22, 0.85, 0.2], lead: 0.15 };

// every clip: its words, and for a page's part how long its speech is (s), the echo after it left out
export const CLIPS = {
  chime: { words: '(the chime: two soft notes)' },
  shift: { words: 'Attention, all crew. Shift change in ten minutes.' },
  highscore: { words: 'A new Mathball high score has been set in the arena. Congratulations.' },
  radiation: { words: 'Warning. High radiation levels outside the station. No E.V.A. until further notice.' },
  'crew-hale': { words: 'Captain Hale is looking for crew for an urgent medical mission. Please see her in the terminal.' },
  'crew-ruiz': { words: 'Captain Ruiz is looking for a pilot and a drill operator for a mining run.' },
  'crew-vega': { words: 'Captain Vega is looking for crew for a trip to new worlds. Please see him in the terminal.' },
  'planet-kepler-blue': { words: 'News from the Explorer. A new world has been found. Its name is Kepler Blue.' },
  'planet-ora': { words: 'News from the Explorer. A new world has been found. Its name is Ora.' },
  'planet-new-tethys': { words: 'News from the Explorer. A new world has been found. Its name is New Tethys.' },
  'planet-vesper': { words: 'News from the Explorer. A new world has been found. Its name is Vesper.' },
  'planet-lumen': { words: 'News from the Explorer. A new world has been found. Its name is Lumen.' },
  'planet-halcyon': { words: 'News from the Explorer. A new world has been found. Its name is Halcyon.' },
  'haul-titanium': { words: 'The Miner has returned with a load of titanium. The smelter is open.' },
  'haul-copper': { words: 'The Miner has returned with a load of copper. The smelter is open.' },
  'haul-nickel': { words: 'The Miner has returned with a load of nickel. The smelter is open.' },
  'haul-platinum': { words: 'The Miner has returned with a load of platinum. The smelter is open.' },
  'haul-cobalt': { words: 'The Miner has returned with a load of cobalt. The smelter is open.' },
  rescue: { words: 'The Medic has brought a stranded crew home safely. Well done, Captain Hale.' },
  'security-explorer': { words: 'Safety violation in the Explorer hangar. Security, to the Explorer hangar.' },
  'security-medic': { words: 'Safety violation in the Medic hangar. Security, to the Medic hangar.' },
  'hangar-clear': { words: 'A ship is returning to the station. Please keep the hangar floor clear.' },
  match: { words: 'A Mathball match is about to begin in the arena.' },
  welcome: { words: 'Welcome aboard Calculation Station. Please see a captain in the terminal to sign on.' },
  cat: { words: 'Would the owner of a small grey cat please collect it from the galley. Again.' },
  running: { words: 'Reminder. No running in the loop hallway. Unless there is an alarm.' },
  'lunch-soup': { words: 'The galley is now serving lunch. Today\'s special is soup.' },
  'lunch-chili': { words: 'The galley is now serving lunch. Today\'s special is chili.' },
  'lunch-spaghetti': { words: 'The galley is now serving lunch. Today\'s special is spaghetti.' },
  'left-sandwich-scanner': { words: 'Whoever left a sandwich in the scanner, please come and get it.' },
  'left-burrito-scanner': { words: 'Whoever left a burrito in the scanner, please come and get it.' },
  'left-taco-arena': { words: 'Whoever left a taco in the arena, please come and get it.' },
  'left-pizza-airlock': { words: 'Whoever left a pizza in the airlock, please come and get it.' },
  'left-banana-crane': { words: 'Whoever left a banana in the crane cab, please come and get it.' },
  boot: { words: 'Lost. One left boot, magnetic. If found, please return it to Captain Adair.' },
  course: { words: 'Attention. The station is exactly on course. As you were.' },
  // (a page's parts: the names, then each place said long and short)
  'name-vega': { words: 'Captain Vega,', len: 0.911 }, 'name-ruiz': { words: 'Captain Ruiz,', len: 0.875 }, 'name-hale': { words: 'Captain Hale,', len: 0.829 },
  'name-adair': { words: 'Captain Adair,', len: 0.982 }, 'name-ana': { words: 'Ana,', len: 0.481 },
  'name-ivo': { words: 'Ivo,', len: 0.458 }, 'name-tess': { words: 'Tess,', len: 0.474 }, 'name-jon': { words: 'Jon,', len: 0.574 },
  'name-ada': { words: 'Ada,', len: 0.508 }, 'name-pia': { words: 'Pia,', len: 0.53 }, 'name-uma': { words: 'Uma,', len: 0.47 },
  'to-control-long': { words: 'please report to the control room.', len: 1.805 }, 'to-control-short': { words: 'to the control room.', len: 1.113 },
  'to-smelter-long': { words: 'please report to the smelter.', len: 1.351 }, 'to-smelter-short': { words: 'to the smelter.', len: 0.918 },
  'to-scanner-long': { words: 'please report to the scanner room.', len: 1.496 }, 'to-scanner-short': { words: 'to the scanner room.', len: 0.973 },
  'to-terminal-long': { words: 'please report to the terminal.', len: 1.283 }, 'to-terminal-short': { words: 'to the terminal.', len: 0.903 },
  'to-miner-long': { words: 'please report to the Miner hangar.', len: 1.697 }, 'to-miner-short': { words: 'to the Miner hangar.', len: 1.07 },
  'to-explorer-long': { words: 'please report to the Explorer hangar.', len: 2.111 }, 'to-explorer-short': { words: 'to the Explorer hangar.', len: 1.198 },
  'to-medic-long': { words: 'please report to the Medic hangar.', len: 1.683 }, 'to-medic-short': { words: 'to the Medic hangar.', len: 1.009 },
  'to-medical-long': { words: 'please report to the medical centre.', len: 1.702 }, 'to-medical-short': { words: 'to the medical centre.', len: 1.07 },
};
export const clipUrl = (id) => new URL('../assets/sound/station/' + id + '.mp3', import.meta.url).href;
// (a text line's strip: under the top's chip (the jobs board's line, 52 px of it), never over the Crew and sound buttons'
// row on a phone; the station's dark glass and cut corners, its teal for the station's own voice)
const CSS = `
.pan { position: fixed; left: 50%; top: calc(max(12px, env(safe-area-inset-top)) + 52px); transform: translate(-50%, -6px); z-index: 13; width: max-content; max-width: min(560px, calc(100vw - 24px));
  padding: 8px 16px 9px; color: #eef1f4; background: rgba(15, 19, 25, 0.88); box-shadow: inset 0 0 0 1.5px rgba(80, 200, 190, 0.6); --cut: 9px;
  clip-path: polygon(var(--cut) 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, var(--cut) 100%, 0 calc(100% - var(--cut)), 0 var(--cut));
  font: 400 15px/1.35 "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif; pointer-events: none; user-select: none; -webkit-user-select: none;
  opacity: 0; visibility: hidden; transition: opacity 0.35s, transform 0.35s, visibility 0s 0.35s; }
.pan.is-on { opacity: 1; visibility: visible; transform: translate(-50%, 0); transition: opacity 0.35s, transform 0.35s; }
.pan small { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #7fd8cf; margin-bottom: 2px; }
.pan p { margin: 0; }
`;
const soundName = (id) => 'station:' + id;

// THE PAGES' WORD BANK: who can be paged (by their id in the roster, life.js) and where to (the scanner room only for
// a real scan, below). Any name with any place. (Not Bo, Oso, Tam, Lin or old Captain Rook: said alone, speech-to-text
// could not make out "Bo" or "Oso" every time, and nobody pages a patient or a traveller.)
export const NAMES = { vega: 'vega', ruiz: 'ruiz', hale: 'hale', adair: 'adair', medic: 'ana', smelter: 'ivo', guard: 'tess', mechanic: 'jon', 'crew-ada': 'ada', 'hauler-pia': 'pia', 'diner-uma': 'uma' };
export const PLACES = ['control', 'smelter', 'terminal', 'miner', 'explorer', 'medic', 'medical'];
// (the news' own words, to the clip that says them: news.js OUT_THERE)
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
export function newsClip(n) {
  const id = n.kind === 'planet' ? 'planet-' + slug(n.planet) : n.kind === 'haul' && n.ship === 'Miner' ? 'haul-' + slug(n.ore) : n.kind === 'rescue' && n.ship === 'Medic' && n.captain === 'Captain Hale' ? 'rescue' : null;
  return id && CLIPS[id] ? id : null;
}
// a captain still asking this crew member (not signed with them, nothing waiting from them, not said yes to already)
const asking = (C) => !!C && (C.state === 'new' || C.state === 'asked' || C.state === 'declined');
const pick = (L, rand) => L[Math.floor(rand() * L.length)];

// THE LINES. say(G, rand) -> null (not true now) or { clips: [ids] } or { page: [nameId, placeId] } or { text: words }
// (no clip: the chime and the words shown, TEXT LINES above), and `news` (a news
// item said: never said again). where: 'station' (everyone) or one room's id. group: lines of one group are one line
// for "said lately". event: said as it happens (G.events has its kind), not in the minute's turn.
export const LINES = [
  { id: 'news', where: 'station', first: 2, say: (G) => { for (const n of G.news || []) { if (G.told.has(n.id)) continue; const c = newsClip(n); if (c) return { clips: [c], news: n.id }; } return null; }, again: 0 },
  // (the rescue's outcome, after its recorded line: how many came home, from where, how many are resting in the ward. A
  // text line: no clip has the numbers in it)
  // (a finding of Captain Vega's exploring run the crew member was on, other than a new world (whose recorded line names
  // it): a text line, its words the run's own: src/exploreplan.js findNews)
  { id: 'found', where: 'station', first: 3, again: 0, say: (G) => { for (const n of G.news || []) { if ((n.kind !== 'find' && n.kind !== 'supply' && n.kind !== 'call') || !n.text || G.told.has(n.id)) continue; return { text: n.text, news: n.id }; } return null; } },
  { id: 'rescued', where: 'station', first: 3, again: 0, say: (G) => { for (const n of G.news || []) { if (n.kind !== 'rescue' || !n.count || G.told.has(n.id + ':outcome') || !G.told.has(n.id)) continue; return { text: outcome({ people: n.count, from: n.from, resting: n.resting }), news: n.id + ':outcome' }; } return null; } },
  { id: 'welcome', where: 'station', first: 1, once: true, say: (G) => (['vega', 'ruiz', 'hale'].some((k) => asking(G.captains[k]) && G.captains[k].room === 'terminal') ? { clips: ['welcome'] } : null) },
  { id: 'crew-hale', group: 'crew', where: 'station', say: (G) => (asking(G.captains.hale) && G.captains.hale.room === 'terminal' ? { clips: ['crew-hale'] } : null) },
  { id: 'crew-vega', group: 'crew', where: 'station', say: (G) => (asking(G.captains.vega) && G.captains.vega.room === 'terminal' ? { clips: ['crew-vega'] } : null) },
  { id: 'crew-ruiz', group: 'crew', where: 'station', say: (G) => (asking(G.captains.ruiz) ? { clips: ['crew-ruiz'] } : null) },
  { id: 'page', where: 'station', again: 240, say: (G, rand) => ({ page: [pick(Object.values(NAMES), rand), pick(PLACES, rand)] }) },
  { id: 'shift', where: 'station', say: () => ({ clips: ['shift'] }) },
  { id: 'radiation', where: 'station', say: () => ({ clips: ['radiation'] }) },
  { id: 'running', where: 'station', say: () => ({ clips: ['running'] }) },
  { id: 'cat', where: 'station', say: () => ({ clips: ['cat'] }) },
  { id: 'boot', where: 'station', say: () => ({ clips: ['boot'] }) },
  { id: 'course', where: 'station', say: () => ({ clips: ['course'] }) },
  { id: 'lunch', where: 'station', say: (G, rand) => ({ clips: [pick(['lunch-soup', 'lunch-chili', 'lunch-spaghetti'], rand)] }) },
  { id: 'left', where: 'station', say: (G, rand) => ({ clips: [pick(['left-sandwich-scanner', 'left-burrito-scanner', 'left-taco-arena', 'left-pizza-airlock', 'left-banana-crane'], rand)] }) },
  // (a Mathball round just over that beat this crew member's own best round: src/mathball/best.js; said each time one
  // is beaten, so its ten minutes' rest is none)
  { id: 'highscore', event: 'best', again: 0, where: 'station', say: () => ({ clips: ['highscore'] }) },
  // ── said as it happens ──
  // (a patient's scan begun: the medic paged to the scanner room, while the scan is still on)
  { id: 'scan', event: 'scan', where: 'station', again: 300, say: (G) => (G.scan && NAMES[G.scan] ? { page: [NAMES[G.scan], 'scanner'] } : null) },
  // (the Miner flown in to another ship's hangar: the alarm there, and this, heard in that hangar)
  { id: 'security', event: 'alarm', again: 60, where: (G) => G.alarm, say: (G) => (G.alarm === 'hangar' ? { clips: ['security-explorer'] } : G.alarm === 'hangar-medic' ? { clips: ['security-medic'] } : null) },
  // (the flown Miner come in to its own hangar from outside: heard in that hangar)
  { id: 'hangar-clear', event: 'shipIn', again: 60, where: 'hangar-miner', say: () => ({ clips: ['hangar-clear'] }) },
  // (the player starting a Mathball match in the arena)
  { id: 'match', event: 'match', again: 180, where: 'station', say: () => ({ clips: ['match'] }) },
];
export const lineOf = (id) => LINES.find((L) => L.id === id) || null;
export const whereOf = (L, G) => (typeof L.where === 'function' ? L.where(G) : L.where);
// heard where the ears are? (place: the room the ears are in, or null: away from the station)
export const heardIn = (where, place) => !!place && !!where && (where === 'station' || where === place);
// how loud, where the ears are, with a card up or not
export const volumeAt = (where, place, math) => (heardIn(where, place) ? ANNOUNCE.volume * (math ? ANNOUNCE.math : 1) : 0);
export const gapAfter = (rand = Math.random, [a, b] = ANNOUNCE.every) => a + (b - a) * rand();
// the clips of what is said, each with when it starts (s from the chime's start)
export function timeline(said) {
  const out = [{ id: 'chime', at: 0 }];
  if (said.page) {
    const [who, to] = said.page, ids = ['name-' + who, `to-${to}-long`, 'name-' + who, `to-${to}-short`];
    let t = ANNOUNCE.chime + PAGE.lead;
    ids.forEach((id, i) => { out.push({ id, at: +t.toFixed(3) }); t += (CLIPS[id] ? CLIPS[id].len : 0) + (PAGE.gaps[i] || 0); });
  } else for (const id of said.clips || []) out.push({ id, at: ANNOUNCE.chime });
  return out;
}
export const wordsOf = (said) => (said.text ? said.text : said.page ? timeline(said).slice(1).map((x) => CLIPS[x.id].words).join(' ') : said.clips.map((id) => CLIPS[id].words).join(' '));

// SOMETHING THAT HAPPENED ELSEWHERE IN THE GAME, told to the station's speakers as it happens (Mathball: 'best', a
// round that beat the crew member's own best): read with the game's facts below, the next frame
const told2 = [];
export function happened(kind) { if (told2.length < 8) told2.push(kind); }

// THE RULES, with no game: what is said, when, where, how loud. read() -> the facts now:
//   { playing, place, math, news: [fresh news], captains: { id: { state, room } }, scan: medic's roster id | null,
//     alarm: the alarm's hangar room id | null, events: [kinds that just happened: 'scan', 'alarm', 'shipIn', 'match',
//     'best'] }
export function makeAnnouncer({ sound, read, rand = Math.random, onText = () => {} }) {
  const T = ANNOUNCE;
  let t = 0, due = null, now = null, waiting = [], lastFacts = null, shown = null;
  // (a text line's words: shown from the chime's end while it is heard where the ears are; null: none)
  const show = (w) => { if (w !== shown) { shown = w; onText(w); } };
  const said = new Map(), told = new Set(), once = new Set(), log = [];
  const quiet = (L) => { const k = L.group || L.id, a = L.again ?? T.again; return !said.has(k) || t - said.get(k) >= a; };
  function choose(G) {
    // (the first true line, first in their order: the welcome, the news; else one at random of the rest)
    const ok = [];
    for (const L of LINES) {
      if (L.event || L.held || (L.once && once.has(L.id)) || !quiet(L)) continue;
      const s = L.say(G, rand); if (!s) continue;
      // (a text line waits while a question card is up: its words would be read over the card's)
      if (s.text && G.math) continue;
      if (!heardIn(whereOf(L, G), G.place)) continue;
      ok.push({ L, s });
    }
    const firsts = ok.filter((x) => x.L.first).sort((a, b) => a.L.first - b.L.first);
    return firsts[0] || (ok.length ? ok[Math.floor(rand() * ok.length)] : null);
  }
  function begin(L, s, G, why) {
    const parts = timeline(s), where = whereOf(L, G);
    now = { L, s, where, parts, t0: null, handles: [], vol: -1, why, loadT: 0, words: wordsOf(s) };
    for (const p of parts) sound.load(soundName(p.id), clipUrl(p.id));
  }
  function start(G) {
    const vol = volumeAt(now.where, G.place, G.math);
    now.handles = now.parts.map((p) => sound.play(soundName(p.id), { group: 'station', volume: vol, delay: p.at }));
    now.vol = vol; now.t0 = t;
    // (how long it lasts: its last clip's start and length; a text line, the chime and then its words' reading time)
    now.ends = Math.max(...now.parts.map((p) => p.at + (sound.length(soundName(p.id)) || 0)));
    if (now.s.text) now.ends = Math.max(now.ends, T.chime + readSecs(now.s.text));
    const L = now.L; said.set(L.group || L.id, t); if (L.once) once.add(L.id); if (now.s.news) told.add(now.s.news);
    log.push({ t: +t.toFixed(1), id: L.id, clips: now.parts.map((p) => p.id), words: now.words, text: !!now.s.text, where: now.where, place: G.place, volume: +vol.toFixed(3), math: !!G.math, why: now.why, heard: now.handles.every(Boolean) });
  }
  const A = {
    log, told,
    get now() { return now; }, get due() { return due; }, get t() { return t; },
    // a line said as if it had happened (the rigs)
    say(id) { const L = lineOf(id); if (!L) return false; waiting.push({ L, until: t + T.wait, forced: true }); return true; },
    // the minute's turn in s seconds (the rigs)
    next(s) { due = t + s; },
    update(dt, G = read()) {
      t += dt; lastFacts = G;
      G.told = told;
      if (!G.playing) { if (now && now.t0 != null && now.vol !== 0) { for (const h of now.handles) if (h) h.volume(0); now.vol = 0; } show(null); due = null; waiting = []; return; }
      if (due == null) due = t + T.first[0] + (T.first[1] - T.first[0]) * rand();
      // (what just happened: said when it can be)
      for (const k of G.events || []) for (const L of LINES) if (L.event === k && quiet(L) && !waiting.some((w) => w.L === L)) waiting.push({ L, until: t + T.wait });
      waiting = waiting.filter((w) => t <= w.until);
      // the one playing: its volume where the ears are now; over, the next minute counted from its end
      if (now && now.t0 != null) {
        const vol = volumeAt(now.where, G.place, G.math);
        if (Math.abs(vol - now.vol) > 0.001) { for (const h of now.handles) if (h) h.volume(vol); now.vol = vol; }
        show(now.s.text && t - now.t0 >= T.chime && t - now.t0 < now.ends && heardIn(now.where, G.place) && !G.math ? now.words : null);
        if (t - now.t0 >= now.ends) { now = null; show(null); due = t + gapAfter(rand); }
        return;
      }
      // one picked, its clips on their way: begun once they are all ready (given up after a while)
      if (now) {
        // (a text line's words are shown even with no chime to be had: the sound off, or not yet allowed by the browser)
        if (now.parts.every((p) => sound.has(soundName(p.id))) || (now.s.text && now.loadT > 1)) start(G);
        else if ((now.loadT += dt) > T.wait) { now = null; due = t + T.retry; }
        return;
      }
      // something that happened, heard where the ears are, and still true
      while (waiting.length) {
        const w = waiting.shift(), s = w.L.say(G, rand), where = s && whereOf(w.L, G);
        if (s && heardIn(where, G.place)) { begin(w.L, s, G, w.forced ? 'asked' : 'happened'); return; }
        if (s && !w.forced && w.L.event && t + 0.5 <= w.until) { waiting.unshift(w); break; }      // (not there yet: it waits a little)
        if (w.forced && s) { log.push({ t: +t.toFixed(1), id: w.L.id, words: wordsOf(s), where, place: G.place, volume: 0, heard: false, why: 'not heard here' }); }
      }
      if (now) return;
      // the minute's turn
      if (t >= due) {
        const c = G.place ? choose(G) : null;
        if (c) begin(c.L, c.s, G, 'minute'); else due = t + T.retry;
      }
    },
    state: () => ({ t: +t.toFixed(1), due: due == null ? null : +due.toFixed(1), playing: now && now.t0 != null ? { id: now.L.id, words: now.words, text: !!now.s.text, where: now.where, volume: +now.vol.toFixed(3), since: +(t - now.t0).toFixed(1), ends: +now.ends.toFixed(2) } : null, shown,
      loading: now && now.t0 == null ? now.L.id : null, waiting: waiting.map((w) => w.L.id), place: lastFacts ? lastFacts.place : null, math: lastFacts ? !!lastFacts.math : false, said: log.length }),
  };
  return A;
}

// THE GAME'S FACTS, read each frame: where the ears are, a card up or not, the captains, the scan, the alarm, a ship
// coming in, a match starting. Then the rules above.
export function makeAnnounce({ sound, W, visit = null, people = () => null, crew = () => null }) {
  let place = null, seen = null, seenT = 0, flownOut = false, scanWas = null, alarmWas = null, arenaWas = false;
  const ear = () => W.seenFrom || W.camera.position;
  function where() {
    if (W.alone) return null;      // (out at the rocks, in the wormhole: the station is not there)
    const p = ear(), z = W.zoneAt(p);
    return z && z.box.distanceToPoint(p) <= 0.3 ? z.id : null;
  }
  const roomOf = (P) => { const z = P && W.zoneAt(P.pos); return z && z.box.distanceToPoint(P.pos) <= 0.3 ? z.id : null; };
  let playing = false, dt0 = 0;
  function read() {
    const events = [];
    // the ears' room, once they have been in it a moment (walking through a doorway is not two rooms at once)
    const p = where();
    if (p !== seen) { seen = p; seenT = 0; } else seenT += dt0;
    const was = place;
    if (seenT >= ANNOUNCE.settle || (p == null) !== (place == null)) place = seen;
    // (a flown ship outside the station: come in to the Miner's own hangar, it is a ship coming in)
    const flying = !!(visit && visit.focus);
    if (place == null && flying) flownOut = true;
    if (place != null && place !== was) { if (flownOut && flying && place === 'hangar-miner') events.push('shipIn'); flownOut = false; }
    const pp = people(), c = crew(), captains = {};
    if (pp) for (const id of ['vega', 'ruiz', 'hale', 'adair']) { const P = pp.list.find((x) => x.id === id); if (P) captains[id] = { state: missions.state(id, c), room: roomOf(P) }; }
    const busy = pp && pp.SCAN ? pp.SCAN.busy : null;
    if (busy && busy !== scanWas && busy.medic) events.push('scan');
    scanWas = busy;
    const alarm = visit && visit.alarm ? visit.alarm.hangar : null;
    if (alarm && alarm !== alarmWas) events.push('alarm');
    alarmWas = alarm;
    // (a question card up: any job's card, or Mathball's screen, which is also a match begun)
    const doc = typeof document !== 'undefined' ? document : null, arena = !!(doc && doc.querySelector('.mbl'));
    if (arena && !arenaWas) events.push('match');
    arenaWas = arena;
    // (told from elsewhere: a Mathball round that beat this crew member's best)
    if (told2.length) events.push(...told2.splice(0));
    const math = arena || !!(doc && doc.querySelector('.pnj'));
    return { playing, place, math, news: news.fresh(), captains, scan: busy && busy.medic ? busy.medic.id : null, alarm, events };
  }
  // (A TEXT LINE'S WORDS on the screen: a strip at the top, under the line's chip where one is up, in the station's look;
  // made the first time one is said)
  let strip = null;
  function onText(words) {
    if (typeof document === 'undefined') return;
    if (!strip) {
      if (!document.getElementById('pan-css')) { const st = document.createElement('style'); st.id = 'pan-css'; st.textContent = CSS; document.head.appendChild(st); }
      strip = document.createElement('div'); strip.className = 'pan'; strip.setAttribute('role', 'status'); strip.innerHTML = '<small>Station announcement</small><p></p>';
      document.body.appendChild(strip);
    }
    if (words) strip.querySelector('p').textContent = words;
    strip.classList.toggle('is-on', !!words);
  }
  const A = makeAnnouncer({ sound, read, onText });
  // (the chime and the lines that happen of a sudden, fetched once play begins: small, and wanted at once)
  let fetched = false;
  const update = A.update;
  A.update = (dt, isPlaying) => {
    playing = !!isPlaying; dt0 = dt;
    if (playing && !fetched) { fetched = true; for (const id of ['chime', 'hangar-clear', 'security-explorer', 'security-medic', 'name-ana', 'to-scanner-long', 'to-scanner-short']) sound.load(soundName(id), clipUrl(id)); }
    update(dt);
  };
  return A;
}
