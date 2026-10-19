// The solving-for-x ladder: which lock box comes next, and how a finished box moves the kid along.
//
// The rules (from the research brief):
//   - Each rung has one track of levels: 2, 3 or 4 (the tray always shows 4 buttons; the level sets the numbers
//     and how quiet the steps card is). 3 clean boxes in a row move up a level; 1 box that is not
//     clean moves down a level, never down a whole rung. (That settles near 79% success.)
//   - A rung is stamped at 4 of the last 5 clean at level 4, and the next rung opens.
//   - First visit climbs fast: one box per rung while every box is clean, starting at R1 (so a 16-year-old isn't
//     stuck on x + 4 = 9). One slip is forgiven: the kid gets another box of the same rung. The second box that is
//     not clean ends the climb, and the kid starts one rung below it.
//   - A new rung starts with 3 to 5 of its own boxes in a row. Once 2 rungs are stamped, older rungs are mixed in
//     (about two boxes in three), nearest rungs first, so look-alikes sit side by side.
//   - A box type that was missed comes back 2 to 4 boxes later.
//   - A session (a gap of 2 hours or more) starts with two easy boxes from stamped rungs.
//   - On the vault rung, about one box in ten asks "infinitely many solutions or no solution?"; never two in a row,
//     never the first box after a level-up. The rest are real solve-for-x boxes.
//   - Level 5, "do the arithmetic": earned in review (once a rung from R5 up is stamped, some of its review boxes come
//     at level 5). Every box now has the kid work out each part of every move (parts.js), so the panel plays a level 5
//     box like a level 4 one; the level is kept so the ladder's records stay as they were. The adding slips a kid
//     makes on those parts are still counted here (arith) for the Grown-ups corner.
//   - After the equations come the inequalities (I1 .. I4, ineq.js): they open and climb exactly like the rungs
//     before them.
// "Clean" = solved within par + 1, no hint past the first, the check passed, no jam, no wrong pick.
//
// ON THE STRANDS (the game today): makeAlgebra(state, { strand: true }). How hard each box is comes from the skill
// model's equations and inequalities strands (src/math/skill.js; strand.js turns a level into a rung and a level 2-4,
// and picks the reviews, warm-ups and comebacks), and the climb above never runs: next(tier, plan) makes the box the
// plan asks for, record(result) keeps the counts, the traps, the slips and the comebacks, and follow(...) mirrors the
// strand's verdict into rung / levels / placing / stamped, which the deer, the sheep, the sheriff's box tier and the
// Grown-ups corner still read. Without { strand: true } (and without a plan) the ladder climbs on its own as above:
// the old riders' saves were made that way, and the tests keep it honest.
//
// The state object lives inside the rider (rider.topics.algebra) and is plain JSON; it is changed in place.

import { generate, makeRng, RUNG, RUNG_IDS, rungIndex, VERDICT_SHARE } from './generate.js';
import { K_RUNG } from './kbox.js';
import { WORK_RUNG } from './workout.js';
import { TRAP_TAGS } from './buttons.js';

// Tuning (defaults that can be changed here):
export const SESSION_GAP_MS = 2 * 60 * 60 * 1000;   // a gap this long starts a new session
export const PLACEMENT_SLIPS_FORGIVEN = 1;          // first-visit climb: slips forgiven before it ends (1 = ends at the 2nd)
export const ARITH_LEVEL = 5;                        // the "do the arithmetic" level (pick the tidied line)
export const ARITH_FROM = 'R5';                      // ...for review boxes of stamped rungs from this one up (negatives)
export const ARITH_REVIEW_SHARE = 0.5;               // ...this share of them
export const NUMBER_LINE_SHOWS = 4;                  // a sum mixing a negative and a positive gets a number line drawn
                                                     // under it this many times (more after a slip on one)
export const ARITH_TAGS = ['sign', 'flip', 'drop', 'oneside'];   // the arithmetic slips (see tidy.js)
const SLIP_WORDS = { sign: 'took away instead of adding', flip: 'the wrong sign on the answer', drop: 'dropped the signs',
  oneside: 'did one side only' };

function fill(s) {
  const d = {
    v: 1, rung: 'R1', placing: true, levels: {}, streak: {}, hist: {}, stamped: [], placed: [],
    ownRun: 0, ownNeed: 4, due: [], recent: [], traps: {}, tools: [], slips: 0, arith: {}, lines: 0,
    boxes: 0, solved: 0, atPar: 0, clean: 0, left: 0, warm: 0, lastAt: 0, lastVerdict: false, justUp: false,
  };
  for (const [k, v] of Object.entries(d)) if (s[k] === undefined) s[k] = v;
  for (const t of TRAP_TAGS) if (typeof s.traps[t] !== 'number') s.traps[t] = 0;
  for (const t of ARITH_TAGS) if (typeof s.arith[t] !== 'number') s.arith[t] = 0;
  if (!RUNG[s.rung]) s.rung = 'R1';
  return s;
}

const levelOf = (s, rung) => s.levels[rung] ?? 2;
const nextRung = (id) => RUNG_IDS[Math.min(RUNG_IDS.length - 1, rungIndex(id) + 1)];
const prevRung = (id) => RUNG_IDS[Math.max(0, rungIndex(id) - 1)];

export function makeAlgebra(state = {}, { rng = makeRng(), now = () => Date.now(), strand = false } = {}) {
  const s = fill(state);

  // a new session starts with two easy boxes from stamped rungs (on the strands: from rungs well below the level,
  // when there are any: strand.js planBox)
  if (s.lastAt && now() - s.lastAt > SESSION_GAP_MS && (s.stamped.length || strand)) s.warm = 2;

  function reviewRung() {
    // older stamped rungs, nearest to the frontier first (look-alikes side by side)
    const older = s.stamped.filter((r) => r !== s.rung && RUNG[r].stage);
    if (!older.length) return null;
    older.sort((a, b) => rungIndex(b) - rungIndex(a));
    const near = older.slice(0, 3);
    return rng.chance(0.75) ? rng.pick(near) : rng.pick(older);
  }

  // next(tier, plan) -> a problem from generate.js plus { level, size, review, tier }
  // plan (on the strands, strand.js planBox): { rung, level (2..5), frac (K boxes: how big the numbers are), review }
  // A plan for a "Work it out" box (workout.js: O1..O5, P1..P5) gets that box; this ladder has no part in it.
  function next(tier = 'iron', plan = null) {
    if (plan && WORK_RUNG[plan.rung]) {
      const p = generate(plan.rung, { rng, frac: plan.frac, recent: s.recent });
      s.recent.push(p.key);
      if (s.recent.length > 20) s.recent.splice(0, s.recent.length - 20);
      return { ...p, level: plan.level ?? 3, size: 2, review: false, tier };
    }
    let rung = s.rung, review = false, level = levelOf(s, s.rung);
    const due = plan ? null : s.due.find((d) => d.at <= s.boxes);
    if (plan && (RUNG[plan.rung] || K_RUNG[plan.rung])) { rung = plan.rung; level = plan.level ?? 3; review = !!plan.review; }
    else if (s.placing) level = 3;
    else if (s.warm > 0 && s.stamped.length) { rung = reviewRung() || s.stamped[s.stamped.length - 1]; review = true; level = 3; }
    else if (due) { rung = due.rung; review = rung !== s.rung; level = review ? 3 : level; }
    else if (s.stamped.length >= 2 && s.ownRun >= s.ownNeed && tier !== 'vault' && rng.chance(2 / 3)) {
      const r = reviewRung();
      if (r) {
        rung = r; review = true; level = 4;
        if (rungIndex(r) >= rungIndex(ARITH_FROM) && rng.chance(ARITH_REVIEW_SHARE)) level = ARITH_LEVEL;
      }
    }
    let size = { 2: 1, 3: 2, 4: 2 }[level] ?? 2;
    if (tier === 'tin') size -= 1;
    if (tier === 'brass') size += 1;
    if (tier === 'vault') size += level >= 3 ? 1 : 0;
    size = Math.max(1, Math.min(3, size));
    // the vault rung: an "infinitely many / no solution" box is rare (VERDICT_SHARE), never two in a row and never
    // the first box after a level-up; the rest are real solve-for-x boxes
    let verdict;
    if (RUNG[rung]?.verdicts) verdict = !s.lastVerdict && !s.justUp && rng.chance(VERDICT_SHARE);
    s.justUp = false;
    const frac = plan ? plan.frac : undefined;   // (the kindergarten boxes grow their numbers with it)
    const p = generate(rung, { rng, size, recent: s.recent, verdict, frac }) || generate(rung, { rng, size, verdict, frac });
    s.lastVerdict = p.kind === 'all' || p.kind === 'none';
    s.recent.push(p.key);
    if (s.recent.length > 20) s.recent.splice(0, s.recent.length - 20);
    return { ...p, level, size, review, tier };
  }

  // record({ rung, clean, solved, stars, moves, par, hints, jammed, keyFailed, left, traps: [tags], tools: [kinds],
  //   arith: [arithmetic slip tags] })
  function record(r) {
    s.lastAt = now();
    if (WORK_RUNG[r.rung]) return;   // (a "Work it out" box isn't on this ladder: the skill model has it, strand.js)
    s.boxes++;
    if (s.warm > 0) s.warm--;
    if (r.solved) s.solved++;
    if (r.solved && r.moves <= r.par) s.atPar++;
    if (r.clean) s.clean++;
    if (r.left) s.left++;
    for (const t of r.traps || []) if (t in s.traps) s.traps[t]++;
    for (const t of r.arith || []) if (t in s.arith) s.arith[t]++;
    for (const k of r.tools || []) if (!s.tools.includes(k)) s.tools.push(k);
    const rung = r.rung;
    // a missed box type comes back 2 to 4 boxes later
    const di = s.due.findIndex((d) => d.rung === rung && d.at <= s.boxes);
    if (di >= 0) s.due.splice(di, 1);
    if (!r.clean && !s.due.some((d) => d.rung === rung)) s.due.push({ rung, at: s.boxes + rng.int(2, 4) });
    if (strand) return;            // on the strands the skill model moves the level, never this ladder (follow)
    if (rung !== s.rung) return;   // a review box never moves the frontier

    if (s.placing) {
      if (r.clean) {
        if (!s.stamped.includes(rung)) { s.stamped.push(rung); s.placed.push(rung); }
        const nr = nextRung(rung);
        if (nr === rung) s.placing = false;
        s.rung = nr;
        s.justUp = true;
        s.levels[nr] = s.levels[nr] ?? 3;
      } else if (s.slips < PLACEMENT_SLIPS_FORGIVEN) {
        // a slip is forgiven once: another box of the same rung, still climbing
        s.slips++;
      } else {
        s.placing = false;
        const below = rung === 'R1' ? 'R0b' : prevRung(rung);
        s.stamped = s.stamped.filter((x) => x !== below);
        s.placed = s.placed.filter((x) => x !== below);
        s.rung = below;
        s.levels[below] = 3;
        s.streak[below] = 0;
        s.ownRun = 0;
        s.ownNeed = rng.int(3, 5);
      }
      return;
    }

    s.ownRun++;
    const lvl = levelOf(s, rung);
    const hist = (s.hist[rung] = [...(s.hist[rung] || []), r.clean ? 1 : 0].slice(-5));
    // stamped on a clean box at level 4 when 4 of this rung's last 5 boxes were clean
    if (lvl >= 4 && r.clean && hist.length >= 4 && hist.reduce((a, b) => a + b, 0) >= 4 && !s.stamped.includes(rung)) {
      s.stamped.push(rung);
      const nr = nextRung(rung);
      s.justUp = true;
      if (nr !== rung) {
        s.rung = nr;
        s.levels[nr] = s.levels[nr] ?? 2;
        s.streak[nr] = 0;
        s.ownRun = 0;
        s.ownNeed = rng.int(3, 5);
      }
      return;
    }
    if (r.clean) {
      s.streak[rung] = (s.streak[rung] || 0) + 1;
      if (s.streak[rung] >= 3 && lvl < 4) { s.levels[rung] = lvl + 1; s.streak[rung] = 0; s.justUp = true; }
    } else {
      s.streak[rung] = 0;
      s.levels[rung] = Math.max(2, lvl - 1);
    }
  }

  // On the strands: the skill model's verdict after a box, mirrored into the ladder's own fields (strand.js syncLadder).
  // rung: the equation or inequality rung the level sits on (never a kindergarten one: the deer and the sheep read
  // it); level: 2..4 within it; placed: the level is found; stamped: the rungs well below the level. A rung (or a
  // level within it) that went up makes the next box "just after a level-up" (no vault verdict box then).
  function follow({ rung, level = 2, placed = true, stamped = [] } = {}) {
    if (!RUNG[rung]) return;
    const was = s.rung, wasLevel = levelOf(s, s.rung);
    if (rungIndex(rung) > rungIndex(was) || (rung === was && level > wasLevel)) s.justUp = true;
    s.rung = rung;
    s.levels[rung] = Math.max(2, Math.min(4, Math.round(level)));
    s.placing = !placed;
    s.stamped = stamped.filter((r) => RUNG[r]);
  }

  // The trap that fools this kid most (at least twice), or null.
  function fav() {
    let best = null, n = 1;
    for (const t of TRAP_TAGS) if (s.traps[t] > n) { best = t; n = s.traps[t]; }
    return best;
  }
  // The arithmetic slip this kid makes most (at least twice), or null: the do-the-arithmetic cards lean on it.
  function favArith() {
    let best = null, n = 1;
    for (const t of ARITH_TAGS) if (s.arith[t] > n) { best = t; n = s.arith[t]; }
    return best;
  }
  // The number line under a sum that mixes a negative and a positive: shown the first few times, and again for a
  // while after each slip on one (each slip earns two more).
  const slipCount = () => ARITH_TAGS.reduce((n, t) => n + s.arith[t], 0);
  const numberLineDue = () => s.lines < NUMBER_LINE_SHOWS + 2 * (s.arith.sign + s.arith.flip + s.arith.drop);
  const sawNumberLine = () => { s.lines++; };

  function level() {
    const rung = RUNG[s.rung];
    const lv = levelOf(s, s.rung);
    return {
      rung: s.rung, name: rung.name, level: s.placing ? 3 : lv, placing: s.placing, stamped: [...s.stamped],
      slips: { ...s.arith },
      label: `${rung.name} (${s.rung}) · ${s.placing ? 'first climb' : `level ${lv}`} · ${s.stamped.length} stamped`,
      // for the Grown-ups corner: the same, plus the adding slips this kid has made picking tidied lines
      line: `${rung.name} (${s.rung}) · ${s.placing ? 'first climb' : `level ${lv}`} · ${s.stamped.length} stamped`
        + (slipCount() ? ` · ${slipCount()} adding slip${slipCount() === 1 ? '' : 's'}${favArith() ? ` (mostly ${SLIP_WORDS[favArith()]})` : ''}` : ''),
    };
  }

  // Animations run 0.8 s per move at first and 0.3 s on rungs the kid has stamped.
  const speed = (rung) => (s.stamped.includes(rung) ? 0.3 : 0.8);
  const seenTool = (k) => s.tools.includes(k);

  return { next, record, follow, level, fav, favArith, numberLineDue, sawNumberLine, speed, seenTool, state: s };
}
