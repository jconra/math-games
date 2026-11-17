// THE WARD'S VARIANT NAMES, read into plain facts (no drawing here, so the tests can read them too): a room file
// dresses a bay by these names (kit/ward.js draws them).
//   curtainOf('side drawn 2.5')    -> { where: 'side' | 'foot', how: one of CURTAIN_HOW, len: metres }, or null
//   tableThings('flowers card')    -> ['flowers', 'card']: what stands on a bedside table, left to right ('bare': nothing)
//   wardBedOf('ward 2, left rail down') -> { ward: 2, down: -1 }: a ward bed's number and which side's long rail is
//                                     folded down (-1 the left of someone at its foot, 1 the right, 0 neither), or null
export const CURTAIN_HOW = ['drawn', 'half', 'back', 'end', 'bare'];
// (how much of its track a curtain's cloth takes up: all of it drawn, about half, or a bunch half a metre wide)
export const BUNCH = 0.5;
export function curtainOf(v) {
  const m = /^(side|foot) (drawn|half|back|end|bare) (\d+(?:\.\d+)?)$/.exec(String(v));
  return m ? { where: m[1], how: m[2], len: Math.max(0.6, Math.min(12, parseFloat(m[3]))) } : null;
}
// (the part of its track, from and to in metres along it, that a curtain's cloth hangs along: a person cannot walk
// through cloth; null for a bare track)
export function clothSpan(v) {
  const c = curtainOf(v); if (!c || c.how === 'bare') return null;
  const a = c.where === 'side' ? 0.035 : 0.03, b = c.len - 0.03;
  return c.how === 'drawn' ? [a, b] : c.how === 'half' ? [a, a + (b - a) * 0.52] : c.how === 'back' ? [a, a + BUNCH] : [b - BUNCH, b];
}
export const THING_NAMES = ['flowers', 'flowers2', 'bear', 'card', 'card2', 'book', 'books', 'cup'];
export const tableThings = (v) => String(v).split(' ').filter((n) => n && n !== 'bare');
export const tableOk = (v) => tableThings(v).length <= 3 && tableThings(v).every((n) => THING_NAMES.includes(n));
export function wardBedOf(v) {
  const m = /^ward (\d+)(?:, (left|right) rail down)?$/.exec(String(v));
  return m ? { ward: +m[1], down: m[2] === 'left' ? -1 : m[2] === 'right' ? 1 : 0 } : null;
}
