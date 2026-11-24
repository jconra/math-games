// MATHBALL SKILL: how good each of the station's people is at Mathball, a whole number from 1 to 10, kept here and
// nowhere else. The game's maker (2026-11-24): "It could be interesting if npcs had had "Mathball Skill" value. So you
// could challenge players that had high skill and they would be scoring points faster." A higher skill scores faster
// and is right more often (game.js OTHER.atSkill); at every skill the other player still keeps pace with the player
// ("they shouldn't stomp you, but they also shouldn't let you win").
//
// SKILLS: the station's own people (src/life.js ROSTER and ROOM_CREW, and the two on the arena's start card who are not
// in the roster), worked out from who they are. Captain Vega is the one 10 (the station's gossip: she was thought
// unbeatable, till "the Captain lost at Mathball last night"); the start card's three keep their order: Ola 3 (still
// learning), Pilot Sol 6 (a fair match), Captain Vega 10 (hard to beat), the three points the old levels were.
// Anyone else (a rescued survivor, someone new): worked out from who they are (their look, else their id), the same
// every time, 1 to 9 (never above Vega).
//
//   skillOf(id, who)   who (optional): the person ({ def, rescued }), so one with no fixed skill is worked out from
//                      their look rather than an id that may be given again another day
export const SKILLS = {
  // the start card's three
  'visitor-ola': 3, 'pilot-sol': 6, vega: 10,
  // the captains: the other ship captains play a fair bit; old Captain Rook has played for years
  ruiz: 7, hale: 6, adair: 8, rook: 8, 'hauler-captain': 5,
  // the station's own
  cook: 4,          // Bo, at the galley all day
  medic: 5,         // Ana
  smelter: 4,       // Ivo, at the forge
  guard: 7,         // Tess, security: quick on her feet
  patient: 2,       // Tam, in for a check-up
  traveller: 3,     // Lin, passing through
  mechanic: 5,      // Jon
  'crew-ada': 6,    // Ada, the Explorer's crew
  'miner-oso': 4,   // Oso
  'hauler-pia': 3,  // Pia
  'diner-uma': 5,   // Uma
  // the control room
  'radio-rhea': 4, 'traffic-milo': 7, 'duty-dara': 5, 'readouts-finn': 6,
  // Cargo
  'clerk-gus': 3, 'packer-nell': 4, 'stock-sami': 6, 'loader-otto': 2,
};
export const SKILL = { least: 1, most: 10, others: 9 };

// a short string's number, the same every time (FNV-1a)
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// a look as words that do not depend on the order its parts were written in
function lookKey(look) {
  if (look == null) return '';
  if (typeof look !== 'object') return String(look);
  if (Array.isArray(look)) return '[' + look.map(lookKey).join(',') + ']';
  return '{' + Object.keys(look).sort().map((k) => k + ':' + lookKey(look[k])).join(',') + '}';
}
export function skillOf(id, who = null) {
  if (id != null && SKILLS[id] != null) return SKILLS[id];
  const look = who && ((who.rescued && who.rescued.look) || (who.def && (who.def.look || who.def.recipe)) || who.look);
  const key = look ? 'look:' + lookKey(look) : 'id:' + String(id ?? '');
  return SKILL.least + (hash(key) % SKILL.others);
}
