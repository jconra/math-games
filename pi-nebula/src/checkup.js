// ROUTINE CHECK-UPS AT THE BIG SCANNER, THE PLAIN PART (no three.js, so the tests run it in Node:
// tests/checkup.test.mjs). people.js does the rest (THE SCANNER'S QUEUE).
//
// THE GAME'S MAKER (2026-11-23): "I feel like the scanner should always be getting used, Whether for rescue mission
// survivors or people that live on the station getting routine check ups."
//
// SO THE SCANNER IS ALWAYS IN USE:
//   - ONE QUEUE, on the medical centre's waiting seats: the rescued whose turn at the scanner is to come (wardplan.js THE
//     OTHERS: every other one of those with no bed, as before) and the station's own people. FIRST COME, FIRST SCANNED:
//     whoever sat down first (firstCome); the scan itself is the station's one scan for all of them (people.js SCAN).
//   - WHENEVER NOBODY IS WAITING OR ON THEIR WAY (none of the rescued, none of the station's own), ONE OF THE STATION'S
//     OWN IS CALLED FOR A ROUTINE CHECK-UP (CHECKUP.ahead: one behind the one on the bed). They leave what they were at
//     (up from a seat as anyone gets up), walk to the medical centre as anyone walks, sit on a waiting seat if the scanner
//     is busy (straight in if it is free), are scanned, and go on with their day where they left it. The next is called
//     as their own scan begins, so the next is on the way, or seated, while the ring goes over them.
//   - WHO: everyone who lives on the main deck and can be spared at that moment (spare). TURN AND TURN ABOUT (whoseTurn):
//     whoever has had the fewest check-ups since the page loaded, then whoever had theirs longest ago, then the nearest.
//   - NOT (spare's reasons): the medic, who runs the scanner; the eight who work in the control room and in Cargo, the
//     two places only the lift goes to (nobody walks out of them, and three of them the game's maker wants always at their
//     desks: life.js ROOM_CREW; so Cargo's loader is never away from a forklift lap); a captain with the crew member
//     (their offer, their contract's card), on their way to their ship or waiting by it, being led to, or with a
//     contract of theirs open (said yes to, signed, or its share not collected yet); anyone talking with someone, at the
//     scanner already, on a machine, running from the crane, or half way onto a seat.
//   - THE MEDIC STAYS: at the scanner's screen between two scans while anyone is waiting or on the way, and nobody asks
//     her away for a talk meanwhile (nor anyone else who is in the queue).
//   - TODAY'S PATIENT (life.js: Tam's day has a scan each time round, Oso's now and then): seated on the medical
//     centre's waiting seats with the scan next in their day, they are in the same queue from the moment they sat down
//     (unless another of the station's own is waiting or on the way already: never two of them behind the one at the
//     scanner, so the rescued never wait for more than two).
//   - THE MEDIC'S WORDS for a routine check-up are lines.js CHECKUP_TALK (nothing is wrong: a check-up); the speakers do
//     not page her for one (paged): she is paged for a patient's scan and for the rescued, as before.
//   - Nothing of it is saved: after a reload the queue begins again (one of the station's own already on the bed, the
//     ring going, as the station loads; the rescued whose turn was still to come seated again, wardplan.js kept).

// THE NUMBERS: how many are kept waiting or on their way behind the one at the scanner; how often the queue is looked
// at (s); called and still not at the scanner after this long, they are let go and someone else is called (s); how
// long one of the station's own sits, at least, before getting up for their turn (s)
export const CHECKUP = { ahead: 1, every: 0.5, giveUp: 360, sit: 2.5 };
// a captain's offer states (missions.js state) that mean a contract of theirs is open with the crew member
export const OPEN = ['interested', 'signed', 'payout'];

// CAN THIS ONE BE SPARED for a check-up just now? -> null (yes), or why not (a word, for the rigs and the tests).
// who: { medic, home (the lift's place they work in, or null), hidden, rescued, queued (in the queue already, or at the
// scanner), act (what they are at: people.js's kinds), phase, talking, fleeing, scripted,
// captain: null | { busy, meet, seeking, state } }
export function spare(who) {
  if (!who) return 'nobody';
  if (who.medic) return 'the medic';
  if (who.home) return 'the lift';
  if (who.rescued) return 'rescued';
  if (who.hidden) return 'away';
  if (who.queued) return 'queued';
  if (!who.act || ['scan', 'scanMedic', 'drive', 'ward', 'talk'].includes(who.act) || who.talking) return 'busy';
  if (who.fleeing || who.scripted || ['sitting', 'rising'].includes(who.phase)) return 'busy';
  const K = who.captain;
  if (K && (K.busy || K.seeking || needed(K))) return 'the captain';
  return null;
}
// A CAPTAIN NEEDED BY THE CREW MEMBER: gone to wait by their ship, or a contract of theirs open. One called for a
// check-up and then needed is let go at once; one who only stops on the way to make their offer goes on after it.
export const needed = (K) => !!K && (!!K.meet || OPEN.includes(K.state));
// WHOSE TURN: of those who can be spared, [{ id, far (m to the medical centre), order }], with what each has had so
// far, done: { id: { n, at } } (how many check-ups, when the last one ended) -> the one to call, or null
export function whoseTurn(list, done = {}) {
  const had = (p) => done[p.id] || { n: 0, at: -Infinity };
  return [...list].sort((a, b) => had(a).n - had(b).n || had(a).at - had(b).at || (a.far || 0) - (b.far || 0) || (a.order || 0) - (b.order || 0))[0] || null;
}
// FIRST COME, FIRST SCANNED: of those seated and waiting, [{ came (when they sat down) }] -> the one whose turn is next
export function firstCome(waiting) {
  let best = null;
  for (const w of waiting) if (w && w.came != null && (!best || w.came < best.came)) best = w;
  return best;
}
// is the medic paged over the speakers as this scan begins (people.js SCAN.busy)? Not for a routine check-up.
export const paged = (busy) => !!(busy && busy.medic && !busy.checkup);
