// THE MUSIC'S WRITTEN TUNES: real tunes, written out note by note, that a song can name (song.tune) so that its lead,
// melody and bass play the tune instead of notes made by dice (src/music/patterns.js arranges it, section by section).
// The game's maker, 2026-11-24: "Would you be able to make an "Old Joe Clark Remix"? Using the notes in a techno and
// innovating way?"
//
// A tune is written in ABC, the folk musicians' plain text for tunes: a letter a note (C D E F G A B from middle C up,
// c d e f g a b the octave above; a ' after a letter puts it an octave higher, a , an octave lower), a number after it
// for how long it lasts in units (no number: one unit), z a rest, | between bars, "X" over a note the chord from there.
// Every note is a letter of the tune's key, so it is kept as a step of the scale from the key's note (0 the key's note,
// 7 the octave over it), and the song's own key and scale say which note each step is: the tune always stays in the
// song's key.
//
//   TUNES[id] = { name, key, scale, unit, form, parts: { A: 'abc', B: 'abc' } }
//       key, scale   the key and scale it is written in (the preset that plays it uses them)
//       unit         sixteenths a written unit lasts (2: a written unit is an eighth note)
//       form         the order the parts come in, as played at a dance ('A', 'A', 'B', 'B')
//   tuneBars(id) -> { A: [bar, ...], B: [...] }   each bar { notes: [[step, len, deg]], chords: [[step, deg]] }
//       step, len in sixteenths (16 a bar); deg: the scale step from the key's note; chords: where a chord begins and
//       its root (a scale step), every bar beginning with the one it starts in
//
// OLD JOE CLARK (joeclark): an Appalachian fiddle tune from the 1800s, traditional (nobody's property). The notes and
// chords are copied from the Mathwood Valley game in this same repo (mathwood-valley/src/audio/stagemusic.js,
// FIDDLE_TUNES.joeclark), which took them from the written tune: the notes as natunelist.net writes it, with the breaths
// at the ends of the lines (bars 4 and 8), the chords as colinhume.com writes them (thesession.org's two settings agree
// on the tune). Copied here as data, not imported: each game keeps its own files. It sits in A mixolydian: A major with
// a G natural, so its two chords are A and G, the home chord and the one a whole step under it.
export const TUNES = {
  joeclark: {
    name: 'Old Joe Clark', key: 'A', scale: 'mixolydian', unit: 2, form: ['A', 'A', 'B', 'B'],
    parts: {
      A: '"A"e2 f2 "G"g2 f2|"A"e2 d2 c4|"A"e2 f2 "G"g2 f2|"A"e4 z4|"A"e2 f2 "G"g2 f2|"A"e2 d2 c4|"A"ABcA "G"B2 G2|"A"A4 z4',
      B: '"A"A2 ABcB A2|"A"e2 d2 c4|"A"A2 ABcB A2|"G"G4 z4|"A"A2 ABcB A2|"A"e2 d2 c4|"A"ABcA "G"B2 G2|"A"A4 z4',
    },
  },
};
export const TUNE_IDS = Object.keys(TUNES);

// a letter's place among the white notes (C = 0 .. B = 6), counted on from middle C's octave
const LETTERS = 'CDEFGAB';
const white = (ch, marks) => {
  const up = ch === ch.toLowerCase();
  let n = LETTERS.indexOf(ch.toUpperCase()) + (up ? 7 : 0);
  for (const m of marks) n += m === "'" ? 7 : -7;
  return n;
};

const cache = new Map();
export function tuneBars(id) {
  if (cache.has(id)) return cache.get(id);
  const T = TUNES[id]; if (!T) return null;
  const home = LETTERS.indexOf(T.key[0]);   // (the key's letter: step 0 is the key's note over middle C, A for A)
  const out = {};
  let chord = 0;
  for (const [name, abc] of Object.entries(T.parts)) {
    out[name] = abc.split('|').map((text) => {
      const bar = { notes: [], chords: [[0, chord]] };
      let at = 0;
      const re = /"([A-G])[^"]*"|([A-Ga-gz])([',]*)(\d*)/g;
      for (let m; (m = re.exec(text));) {
        if (m[1]) { chord = LETTERS.indexOf(m[1]) - home; if (chord > 0) chord -= 7; if (at === 0) bar.chords[0][1] = chord; else bar.chords.push([at, chord]); continue; }
        const len = (m[4] ? +m[4] : 1) * T.unit;
        if (m[2] !== 'z') bar.notes.push([at, len, white(m[2], m[3]) - home]);
        at += len;
      }
      bar.length = at;
      return bar;
    });
  }
  cache.set(id, out);
  return out;
}
export const tuneOk = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(TUNES, id);
