// THE ARMS' LENGTH BY THE BONES, its plain sums (kit/crew.js shortenArms and lib.clipsFor use them; the tests run them):
//   armsFor(entry, A)          the arms' length an outfit wears: everyone's A (crew.js ARM_LENGTH, or lib.armLength
//                              tried in its place), but an outfit with hands of its own (crew.json `ownHands`: the
//                              androids, Captain Vega) wears its own hands' size, its `handSize` (0.3 to 1; else 1)
//   armBonePlaces(P, A)        an arm's bones' places (each its own, from its parent's joint) drawn in: the elbow's
//                              (P.lower, the forearm's joint) and the wrist's to A.arm of themselves, every joint under
//                              the wrist (P.under: { name: [x, y, z] }, the hand's) to A.hand of itself
export function armsFor(entry, A) {
  return entry && entry.ownHands ? { ...A, hand: +entry.handSize > 0.3 && +entry.handSize <= 1 ? +entry.handSize : 1 } : A;
}
export function armBonePlaces(P, A) {
  const k = (v, s) => v.map((x) => x * s);
  return { lower: k(P.lower, A.arm), wrist: k(P.wrist, A.arm), under: Object.fromEntries(Object.entries(P.under).map(([n, v]) => [n, k(v, A.hand)])) };
}
