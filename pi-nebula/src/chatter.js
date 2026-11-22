// WHAT TWO PEOPLE TALK ABOUT: a conversation picked from the line bank (lines.js) for two of the station's people, the
// news going round first (news.js), never one heard lately, never one about either of the two speakers.
//   import { pickTalk, MEMORY } from './chatter.js'
//   pickTalk(A, B, { sitting, player, now, nearby }) -> { id, lines: [{ who: 0 | 1, words }] } | null
//       A, B: the two people ({ id, name } from the roster); sitting: at a table; player: the player's name (or null);
//       now: the game's clock, seconds; nearby: anyone else within earshot ({ id, name }): never talked about
// MEMORY: a conversation is not heard again for MEMORY.again seconds anywhere on the station; a piece of news is talked
// over at most MEMORY.perNews times (then it is old news), and never again by anyone who has talked it over already.
import { TALKS } from './lines.js';
import { news } from './news.js';

export const MEMORY = { again: 9 * 60, perNews: 3 };
const heard = new Map();        // conversation id -> when it was last begun
const told = new Map();         // news id -> how many times it has been talked over
const fill = (s, F) => s.replace(/\{(\w+)\}/g, (m, k) => (F[k] != null ? F[k] : m));

export function pickTalk(A, B, { sitting = false, player = null, now = 0, nearby = [] } = {}) {
  const names = new Set([A.name, B.name, A.id, B.id]);
  for (const X of nearby) { names.add(X.name); names.add(X.id); }
  const ok = (T) => {
    if (heard.has(T.id) && now - heard.get(T.id) < MEMORY.again) return false;
    if (T.sitting === true && !sitting) return false;
    if (T.sitting === false && sitting) return false;
    if (T.about && T.about.some((id) => names.has(id))) return false;
    if (T.who && !(T.who.includes(A.id) && T.who.includes(B.id))) return false;
    return true;
  };
  // (the news first: the newest piece still going round that has a conversation free, and names neither speaker)
  const cands = [];
  for (const N of news.fresh()) {
    if ((told.get(N.id) || 0) >= MEMORY.perNews) continue;
    // (nobody tells, or is told, a piece of news they have already talked over)
    if ((A.knows && A.knows.has(N.id)) || (B.knows && B.knows.has(N.id))) continue;
    if (N.kind === 'player' && !player) continue;
    const facts = { ...N, player: N.player || player };
    if (Object.values(facts).some((v) => typeof v === 'string' && names.has(v))) continue;
    // (only a conversation whose blanks this piece of news fills: a rescue the crew member was on has facts the others
    // have not, how many came home and from where)
    const fills = (T) => T.lines.every((l) => [...l.matchAll(/\{(\w+)\}/g)].every((m) => ['A', 'B', 'player'].includes(m[1]) || facts[m[1]] != null));
    for (const T of TALKS) if (T.news === N.kind && ok(T) && fills(T)) cands.push({ T, N, facts });
    if (cands.length) break;
  }
  // (else the station's own stories; a news one now and then even with plenty of these)
  if (!cands.length || Math.random() < 0.35) {
    const own = TALKS.filter((T) => !T.news && ok(T)).map((T) => ({ T, N: null, facts: { player } }));
    if (own.length) { cands.length = 0; cands.push(...own); }
  }
  if (!cands.length) return null;
  const { T, N, facts } = cands[Math.floor(Math.random() * cands.length)];
  // (a line naming the player when there is no player: that conversation is not for now)
  const F = { ...facts, A: A.name, B: B.name };
  // (a line that starts with a filled-in blank starts with a capital all the same)
  const lines = T.lines.map((s, i) => { const w = fill(s, F); return { who: i % 2, words: w.charAt(0).toUpperCase() + w.slice(1) }; });
  if (lines.some((l) => /\{\w+\}/.test(l.words))) return null;
  heard.set(T.id, now);
  if (N) { told.set(N.id, (told.get(N.id) || 0) + 1); for (const X of [A, B]) (X.knows || (X.knows = new Set())).add(N.id); }
  return { id: T.id, lines };
}
