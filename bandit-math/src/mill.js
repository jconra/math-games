// THE MILL'S BOOKS (pure: no page, no three.js; tests/windmill-job.test.mjs): what the miller pays for a tower that
// stands, the flour his mill grinds while its sails turn, and where the sacks stack on his porch. The windmill job
// (src/windmilljob.js) keeps them in the rider's save, rider.builds.windmill:
//   paid      the tallest tower (feet) the miller has paid flour for (a test pays only for the feet above it)
//   stood     { height, at } the height left standing by the last wind test (the sails go up from SAILS_FT)
//   porch     sacks waiting on the mill's porch (a share of a sack while one is being ground)
//
//   testPay(h, paid)  -> { sacks, paid, sails }  a wind test left h feet standing: the new sacks (a sack for every foot
//                        higher than `paid`, and SAIL_SACKS more the first time she reaches SAILS_FT), the new `paid`
//   grindEvery(h)     -> seconds of play a sack takes to grind, with the sails up on an h ft tower (null: no sails)
//   grind(b, dt, h)   -> whole sacks ground in dt seconds (b.porch grows, up to FLOUR.porch; a test's pay may put more
//                        there, which is kept: the mill just waits till the porch is cleared)
//   sailsUp(b, h)     the sails turn: the last test left SAILS_FT or more standing, and the tower is still that tall
//   stackSpots(n)     -> [{ x, y, z, ry }] where n sacks stand on the porch, in the mill's own frame (metres)
//   payLine(sacks, h, paid, before)   the result card's small line under "The miller pays..."
//   feetOf(h)         whole feet standing, for the buckle (save.js JOBS 'windmill' counts the best height so far)

export const SAILS_FT = 16;      // the lab's TARGET_FT (labs/windmill/testrun.js): from here the miller puts the sails on
export const DONE_FT = 18;       // completion.js WINDMILL_FEET: an 18 ft tower standing counts the windmill done
export const FLOUR = {
  sailSacks: 5,                  // the first time a tower stands SAILS_FT high: sacks for the sails (as the lab's card)
  every16: 90,                   // s of play to grind a sack with the sails up on a 16 ft tower; a taller tower catches
                                 // more wind: every16 x 16 / h (80 s at 18 ft, 60 s at 24 ft)
  fastest: 45,                   // s: never quicker than this, however tall
  porch: 16,                     // the most sacks the porch holds (the mill stops grinding while it is full)
  reach: 3.4,                    // m from the porch's steps where walking past picks the sacks up
};

const whole = (v) => { v = Number(v); return Number.isFinite(v) && v > 0 ? Math.floor(v + 1e-6) : 0; };
const amount = (v) => { v = Number(v); return Number.isFinite(v) && v > 0 ? v : 0; };
export const feetOf = (h) => whole(h);
// the lab's rule (testrun.js flourFor): a sack for every foot, five more for the sails
const flourAt = (h) => whole(h) + (amount(h) >= SAILS_FT ? FLOUR.sailSacks : 0);

export function testPay(h, paid = 0) {
  const p = amount(paid), H = amount(h);
  const sacks = Math.max(0, flourAt(H) - flourAt(p));
  return { sacks, paid: Math.max(p, H), sails: H >= SAILS_FT };
}

export function grindEvery(h) {
  const H = amount(h);
  if (H < SAILS_FT) return null;
  return Math.max(FLOUR.fastest, FLOUR.every16 * SAILS_FT / H);
}

export function sailsUp(b, h) {
  const s = b && b.stood && amount(b.stood.height);
  return !!s && s >= SAILS_FT && amount(h) >= SAILS_FT;
}

// b: the rider's windmill record; h: the tower's height now. The share of a sack ground so far stays in b.porch.
export function grind(b, dt, h) {
  if (!b || !sailsUp(b, h)) return 0;
  const every = grindEvery(Math.min(amount(h), amount(b.stood.height)));
  const was = amount(b.porch);
  if (was >= FLOUR.porch) return 0;   // (full: it waits; a test's pay may have put more there, all kept)
  b.porch = Math.min(FLOUR.porch, was + amount(dt) / every);
  return whole(b.porch) - whole(was);
}

// the line under "The miller pays N sacks of flour" on the result card
export function payLine(sacks, h, before) {
  const was = amount(before);
  if (!sacks) return was > 0 ? `She's stood ${Math.floor(was)} feet before: a sack for every foot higher, on his porch.` : 'A sack for every foot left standing, once she stands.';
  const sails = amount(h) >= SAILS_FT && was < SAILS_FT ? ', and five for the sails' : '';
  return `${was > 0 ? 'A sack for every foot higher than before' : 'A sack for every foot left standing'}${sails}. They wait on his porch.`;
}

// Sacks on the porch: standing side by side in two rows along the porch's front (the end by the steps first), the back
// row set half a sack along. The mill's own frame (metres; its porch runs along +Z, the floor 0.41 m up:
// models/town/mill.glb).
export const PORCH = { floor: 0.41, x0: 1.85, step: -0.5, rows: [1.5, 1.06], back: 0.25, perRow: 8 };
export function stackSpots(n) {
  const out = [], N = Math.min(whole(n), FLOUR.porch, PORCH.rows.length * PORCH.perRow), P = PORCH;
  for (let i = 0; i < N; i++) {
    const row = Math.floor(i / P.perRow), k = i % P.perRow;
    out.push({ x: P.x0 + k * P.step - (row ? P.back : 0), y: P.floor, z: P.rows[row], ry: ((i * 2.39) % 1 - 0.5) * 0.7 });
  }
  return out;
}
