// WHERE A NOTE IS PLAYED ON A STRINGED NECK, from its pitch (no three.js: src/frethands.js, the lab and the tests read the same
// numbers). The same sum for the upright bass (E A D G), the fiddle (G D A E) and the banjo (D G B D; the short fifth string
// isn't fretted).
//   FRETTED          each instrument's open strings (MIDI), its highest stop, how many semitones the hand covers without shifting,
//                    and which finger takes each semitone above the first (the bass's Simandl 1-2-4: the ring helps the little finger)
//   planNote(midi, pos, kind) -> { string, fret, pos, finger, open, octave }
//     pos: the hand's position now (the semitone under the first finger). A stop inside the hand's reach costs nothing; an open
//     string costs a little more the further up the hand is; a shift costs by how far it goes, and the higher the
//     position the dearer. So the hand stays put when it can, plays low on the neck, and takes the cheapest of the strings
//     that can sound the note. A note below the lowest string comes up an octave (octave: +12).
//   fretDistance(n, scale)   metres from the nut to stop n, for a string of that length
export const FRETTED = {
  bass: { open: [28, 33, 38, 43], top: 12, span: 2, fingers: ['Index', 'Middle', 'Pinky'], home: 1, openCost: 0.4 },
  fiddle: { open: [55, 62, 69, 76], top: 9, span: 4, fingers: ['Index', 'Index', 'Middle', 'Ring', 'Pinky'], home: 1, openCost: 0.5 },
  banjo: { open: [50, 55, 59, 62], top: 12, span: 3, fingers: ['Index', 'Middle', 'Ring', 'Pinky'], home: 1, openCost: 0.3 },
};
export const fretDistance = (n, scale) => scale * (1 - Math.pow(2, -n / 12));
export function planNote(midi, pos, kind) {
  const I = FRETTED[kind], low = I.open[0], high = I.open[I.open.length - 1] + I.top; let m = midi, octave = 0;
  while (m < low) { m += 12; octave += 12; }
  while (m > high) { m -= 12; octave -= 12; }
  let best = null;
  I.open.forEach((o, string) => {
    const f = m - o; if (f < 0 || f > I.top) return;
    let cost, np = pos;
    if (f === 0) cost = I.openCost + pos * 0.12;
    else if (f >= pos && f <= pos + I.span) cost = f * 0.03;
    else { np = f < pos ? f : f - I.span; cost = 1 + Math.abs(np - pos) * 0.5 + np * 0.12; }
    if (!best || cost < best.cost) best = { cost, string, fret: f, pos: Math.max(1, np), open: f === 0 };
  });
  const finger = best.open ? null : I.fingers[Math.max(0, Math.min(I.fingers.length - 1, best.fret - best.pos))];
  return { string: best.string, fret: best.fret, pos: best.pos, open: best.open, finger, octave };
}
