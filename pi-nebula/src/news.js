// THE STATION'S NEWS: things that happen (or that people hear have happened), which the station's people then talk
// about (chatter.js picks a conversation about the newest; lines.js says what they say). The game's maker (2026-11-16):
// "It would be cool if there was a system that could reduce the amount of repetitive things being said. Or maybe even
// react to things happening like the news of a medical mission that saved a stranded crew or the discovery of a new
// habitable planet."
//
//   import { news } from './news.js'
//   news.add({ kind, ...facts })     a piece of news, from anywhere in the game (a mission done, a Mathball match, a
//                                    job the player did): the people pick it up from then on
//   news.fresh(kind?)                the news still being talked about (the newest first), or of one kind
//   news.update(dt)                  each frame: now and then something new happens out there by itself
// THE KINDS, and their facts (each fact a few words a line can say; lines.js fills them in where it says {fact}):
//   mathball  { winner, loser, score }         a Mathball match: who won, who lost, the score in words
//   rescue    { ship, captain, crew }          a ship that brought a stranded crew home
//   planet    { planet }                       a new world found that people could live on
//   haul      { ship, ore, tons }              a ship back with a rich load of ore
//   player    { player, job }                  the player did a job shift (main.js, after a job pays)
// A piece of news is talked about for FRESH seconds of the game, then left be.
const FRESH = 20 * 60;
// (what happens by itself, out there: the news that comes in now and then, its facts picked from these)
const OUT_THERE = {
  mathball: () => { const [w, l] = two(['Captain Vega', 'Captain Ruiz', 'Captain Hale', 'Ivo', 'Tess', 'Bo', 'Ada', 'Jon']); return { winner: w, loser: l, score: pick(['7 to 5', '6 to 4', '9 to 8', '5 to 3', '10 to 9']) }; },
  rescue: () => ({ ship: 'Medic', captain: 'Captain Hale', crew: pick(['six miners', 'four scientists', 'a family of five', 'two pilots and their dog', 'a whole survey team']) }),
  planet: () => ({ planet: pick(['Kepler Blue', 'Ora', 'New Tethys', 'Vesper', 'Lumen', 'Halcyon']) }),
  haul: () => ({ ship: 'Miner', ore: pick(['titanium', 'copper', 'nickel', 'platinum', 'cobalt']), tons: pick(['twelve', 'twenty', 'thirty', 'forty-five']) }),
};
const pick = (L) => L[Math.floor(Math.random() * L.length)];
const two = (L) => { const a = pick(L); let b = pick(L); while (b === a) b = pick(L); return [a, b]; };
const same = (a, b) => Object.keys(b).every((k) => a[k] === b[k]);

function makeNews() {
  const list = [];
  let now = 0, next = 240 + Math.random() * 240;
  const N = {
    list,
    add(item) { const n = { ...item, at: now, id: (item.kind || 'news') + ':' + (list.length + 1) }; list.unshift(n); if (list.length > 24) list.length = 24; return n; },
    fresh(kind = null) { return list.filter((n) => now - n.at < FRESH && (!kind || n.kind === kind)); },
    update(dt) {
      now += dt;
      // (something new happens out there every five to nine minutes: not the same kind as the last, nor the same as any
      // still going round; a planet is found only once)
      if (now > next) {
        next = now + 300 + Math.random() * 240;
        const kinds = Object.keys(OUT_THERE).filter((k) => !list[0] || k !== list[0].kind);
        for (let i = 0; i < 8; i++) {
          const k = pick(kinds), item = { kind: k, ...OUT_THERE[k]() };
          if (!list.some((n) => same(n, item) && (k === 'planet' || now - n.at < FRESH))) { N.add(item); break; }
        }
      }
    },
    get now() { return now; },
  };
  // (the station wakes with a little news already going round: a Mathball match last night, and one more)
  N.add({ kind: 'mathball', ...OUT_THERE.mathball() });
  const k = pick(['rescue', 'planet', 'haul']); N.add({ kind: k, ...OUT_THERE[k]() });
  return N;
}
export const news = makeNews();
