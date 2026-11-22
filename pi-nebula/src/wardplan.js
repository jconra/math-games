// THE RESCUED IN THE STATION'S WARD, THE PLAIN PART (piece 5 of the rescue run, ~/pw/space-math/RESCUE_PLAN.md; no
// three.js, so the tests run it in Node: tests/ward.test.mjs). people.js does the rest: the rescued are station people
// with one errand of their own (people.js THE WARD).
//
// THE GAME'S MAKER (MED-6): "If you are just standing there watching them it would be nice if they could walk in there
// and lay down. But if you run off then its fine if they teleport to the bed." (MISSIONS_DRAFT: "in the ward the rescued
// walk in and lie down if watched, else are already in bed".)
//
// SO, BACK AT THE STATION AFTER A RESCUE (the Medic down in its hangar and the crew member up from their seat):
//   - THE RESCUED COME DOWN THE MEDIC'S RAMP, one after another (WARD.gap apart), at its foot on the hangar's floor
//     (never where the camera sees them appear), and walk to the ward: across the Medic's hangar, through the medical
//     centre and the ward's door, each to their own bed's side; there they turn their back to it, hop up onto its edge,
//     swing their legs round and lie back (the big scanner's patient's own moves, src/onbed.js, on the ward's bed).
//   - WATCHED, OR ALREADY IN BED: while the crew member is somewhere along their way (WARD.rooms: the Medic's hangar
//     and the Medic, the medical centre and its rooms, the ward) they walk; gone anywhere else, whoever is not in bed yet
//     is in it at once.
//   - MORE RESCUED THAN BEDS (3 to 6 pods, three beds): the first to come down the ramp take the free beds; THE REST GO
//     HOME: they walk off across the hangar to its way out into the station (where its people come and go) and are gone
//     as soon as nobody sees them (or on reaching it).
//   - THEY STAY A WHILE (WARD.stay: 8 to 12 minutes each, on the wall clock, kept over a reload), then leave: in bed
//     while nobody sees the ward, they are simply gone; seen, they sit up, swing their legs out and slide off (the
//     same moves backwards), walk along its side past its foot and off out of the medical centre and the Medic's hangar
//     the same way, gone as soon as nobody sees them.
//   - THE BEDS: the ward's three (kit/ward.js, the station file's cabinMedBed 'ward 1' to 'ward 3'), each got onto from
//     the side whose long rail is folded down (its variant 'right rail down' or 'left rail down'); a bed with both rails
//     up is not used (someone getting onto it would pass through its rail).
//
//   WARD                        the numbers (above)
//   WARD_BED                    the ward's bed as an onbed.js bed, in its piece's own frame (bedOf)
//   bedSide(variant)            -> 1 (got onto from its +x: 'right rail down'), -1 ('left rail down'), 0 (both rails up)
//   assign(n, beds, taken)      -> for each of n rescued, the bed index they take, or -1 (home): the free beds in turn
//   stayFor(rand)               -> s a rescued person stays in the ward
//   watching(room)              -> is the crew member somewhere along the way (a room's id)
//   numberWord(n), outcome({ people, from, resting })  the words: "five", the station's line for the rescue's outcome
//   kept(list, now)             -> the saved ward (crew.ward) still in bed at `now` (ms on the wall clock)

// THE NUMBERS: the rooms the crew member watches from (the station file's room ids; a ship's own room counts as its
// hangar); how long each stays (s, the least and the most); between one coming down the ramp and the next (s); a way to
// the bed not walked by then (s): put in it (a loud alarm, counted); unseen this long, someone leaving is gone (s)
export const WARD = {
  rooms: ['hangar-medic', 'ship-medic', 'stub-medic', 'medical', 'med-ward', 'med-scanner', 'med-pharmacy', 'med-lab', 'med-booth', 'med-equip'],
  stay: [480, 720],
  gap: 1.6,
  late: 120,
  gone: 0.8,
  // (the most saved: a ward has three beds)
  most: 3,
};
// THE WARD'S BED (kit/shipparts/cabin/medical.js medBed's footprint, kit/ward.js wardBed: its piece's frame has the wall
// line at z = 0, the head board at 0.15, the mattress from 0.21 to 2.18 and 0.82 wide, its top 0.68 m up, the pillow
// from 0.27 to 0.63; the long side rail, folded down, has its top at 0.56, under the mattress's, and its outer face 0.53
// out from the bed's middle). For onbed: the mattress's top, the edge the legs come over (just past the folded rail's
// face), the pad's half width, where the hips lie along it (the head on the pillow, the heels short of the foot board),
// where they stand at its side with their back to it, the hip joints over the pad sitting on its edge, where the hands
// keep off (the pillow); where they walk to, beside it (the way-finder keeps a body that far from its rails), and on
// the way there, past its foot on that side (`via`: the way-finder's search for a way into the narrow room between bed 1
// and the ward's wall ran past what a way may take, from the hangar and even from its foot; from `via` they walk straight
// along the bed's side, as the scanner's patient walks along its bed)
export const WARD_BED = { top: 0.68, edge: 0.5, pad: 0.41, z: 1.22, stand: [0.72, 1.22], hipUp: 0.095, rest: [0.27, 0.63], walkTo: [0.94, 1.22], via: [0.94, 2.65],
  // (each person's own: their hips as far along as lets their toes, lying, stop short of the mattress's end (the foot
  // board stands just past it), the toes past the foot's root by `toes`; no nearer the head than `least`, nor further
  // than `most`: the head then still on the pillow)
  feet: 2.18, toes: 0.17, least: 1.05, most: 1.22 };
// the ward's bed for one person, as onbed.js takes it (who: their measures, moves.js M.body: a thigh, b shin)
export function bedFor(who) {
  const B = WARD_BED, z = Math.min(B.most, Math.max(B.least, B.feet - B.toes - ((who && who.a) || 0.43) - ((who && who.b) || 0.43)));
  return { top: B.top, edge: B.edge, pad: B.pad, z: +z.toFixed(3), stand: [B.stand[0], +z.toFixed(3)], hipUp: B.hipUp, rest: B.rest };
}
// (the bed a variant names: 'ward 2, right rail down' -> 2)
export const bedNumber = (variant) => { const m = /^ward (\d+)/.exec(String(variant || '')); return m ? +m[1] : null; };
// (got onto from the side whose long rail is folded down: 'right' is the right of someone standing at its foot, the
// piece's +x, kit/shipparts/cabin/fit.cat.js)
export function bedSide(variant) {
  const v = String(variant || '');
  return /right rail down/.test(v) ? 1 : /left rail down/.test(v) ? -1 : 0;
}
// the beds the rescued take, in turn: the free ones (not taken), lowest number first; the rest go home (-1)
export function assign(n, beds, taken = new Set()) {
  const free = beds.map((b, i) => ({ b, i })).filter(({ b, i }) => !taken.has(i) && b.side !== 0).sort((p, q) => (p.b.n ?? p.i) - (q.b.n ?? q.i)).map(({ i }) => i);
  return Array.from({ length: Math.max(0, n) }, (_, k) => (k < free.length ? free[k] : -1));
}
export const stayFor = (rand = Math.random) => WARD.stay[0] + (WARD.stay[1] - WARD.stay[0]) * rand();
export const watching = (room) => !!room && WARD.rooms.includes(room);

// THE WORDS
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export const numberWord = (n) => WORDS[n] || String(n);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// where they were brought from, in a few words: the planet's kind (src/planet/kinds.js name) and the wreck beside them
export function fromWords(kindName) {
  const k = String(kindName || '').toLowerCase();
  const where = /moon/.test(k) ? 'on a cratered moon' : /meadow/.test(k) ? 'on a meadow world' : /canyon/.test(k) ? 'in a canyon world' : k ? 'on a ' + k : 'on a far planet';
  return 'a crashed ship ' + where;
}
// THE STATION'S LINE FOR THE RESCUE'S OUTCOME (src/announce.js 'rescued': no clip says it, so its words are shown, the
// chime first, in the manner of the recorded news: "News from the Explorer. A new world has been found."): how many
// were brought home, from where, and how many of them are resting in the ward
export function outcome({ people = 0, from = '', resting = 0 } = {}) {
  const n = Math.max(0, people | 0), who = n === 1 ? 'One person has' : `${cap(numberWord(n))} people have`;
  let s = `News from the Medic. ${who} been brought home from ${from || fromWords('')}.`;
  if (resting > 0) s += resting >= n ? (n === 1 ? ' They are resting in the ward.' : ' They are resting in the ward.') : ` ${cap(numberWord(resting))} of them ${resting === 1 ? 'is' : 'are'} resting in the ward.`;
  return s;
}
// THE SAVED WARD (crew.ward: [{ look, position, bed, until }], `until` on the wall clock, ms): those still in bed at `now`,
// one to a bed, at most WARD.most
export function kept(list, now = Date.now()) {
  const out = [], beds = new Set();
  for (const r of Array.isArray(list) ? list : []) {
    if (!r || typeof r.look !== 'string' || !(r.until > now) || !Number.isInteger(r.bed) || r.bed < 0 || beds.has(r.bed)) continue;
    beds.add(r.bed); out.push({ look: r.look, position: r.position || null, bed: r.bed, until: r.until });
    if (out.length >= WARD.most) break;
  }
  return out;
}
