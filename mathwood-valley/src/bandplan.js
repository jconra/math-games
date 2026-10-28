// THE BAND'S PLAN: the plain parts of the saloon's band (src/stage.js), with no three.js in them, so the tests can read
// them: what the band card offers, which key picks what, what the players say, and how the music from the stage
// reaches the ears through the saloon's walls and doorways.
//
//   bandChoices({ song, resting, songs }) -> rows   the card's rows, in order: [{ id, label, sub, key, keyName, on }]
//                     id: a song's id, 'break' or 'again'; key: the KeyboardEvent.code that picks it; on: the song
//                     playing now. Playing: the songs, then "Take a break". Resting: "Play again" (the song they
//                     stopped on), then the songs
//   choiceForKey(rows, code) -> the row a key picks (or null)
//   bandLine(what, song) -> the words in the speech bubble ('song' | 'again' | 'break' | 'same')
//   soundThrough({ inside, ways }) -> { gain, hz }   how the band is heard where the ears are. inside: the ears in the
//                     saloon's hall (full and open). Else through the walls (quiet and muffled), and through each
//                     doorway way { open (0..1: how far its doors stand open; no door, or the batwings resting open,
//                     is 1), dist (m from the doorway's middle), facing (-1..1: straight out in front of it is 1,
//                     along the wall 0) }: more of the band, and brighter, standing near a doorway and in front of it
//   BAND               the dials
import { SONGS } from './audio/stagemusic.js';

export const BAND = {
  wall: { gain: 0.26, hz: 420 },     // through the walls: this much of the band, its highs gone above hz
  door: { gain: 0.9, hz: 7000 },     // through a doorway right in front of it
  doorNear: 2.5, doorFar: 16,        // m from a doorway: all of what comes through it within doorNear, none past doorFar
  sideways: 0.3,                     // how much a doorway still gives standing beside it (along the wall) to one square in front
};

const SONG_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];

export function bandChoices({ song = null, resting = false, songs = SONGS } = {}) {
  const now = songs.find((s) => s.id === (song && song.id ? song.id : song)) || songs[0];
  const list = songs.map((s, i) => ({ id: s.id, label: s.name, sub: s.feel || '', key: SONG_KEYS[i] || null, keyName: String(i + 1), on: !resting && s.id === now.id }));
  if (resting) return [{ id: 'again', label: 'Play again', sub: now.name, key: 'Enter', keyName: 'Enter' }, ...list];
  return [...list, { id: 'break', label: 'Take a break', sub: 'the band rests', key: 'KeyB', keyName: 'B' }];
}

export function choiceForKey(rows, code) {
  if (!code) return null;
  const k = code === 'NumpadEnter' ? 'Enter' : /^Numpad\d$/.test(code) ? 'Digit' + code.slice(6) : code;
  return rows.find((r) => r.key === k) || null;
}

export function bandLine(what, song) {
  if (what === 'break') return "We'll rest our hands a spell.";
  if (what === 'again') return `Back to it: ${song.name}!`;
  if (what === 'same') return `${song.name}, from the top!`;
  return song.ask || `${song.name} it is!`;
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (u) => { u = clamp01(u); return u * u * (3 - 2 * u); };
export function soundThrough({ inside = false, ways = [] } = {}) {
  if (inside) return { gain: 1, hz: 20000, through: 1 };
  let through = 0;
  for (const w of ways) {
    const near = 1 - smooth((w.dist - BAND.doorNear) / (BAND.doorFar - BAND.doorNear));
    const face = BAND.sideways + (1 - BAND.sideways) * clamp01(w.facing);
    through = Math.max(through, clamp01(w.open ?? 1) * near * face);
  }
  const W = BAND.wall, D = BAND.door;
  return { gain: W.gain + (D.gain - W.gain) * through, hz: W.hz * Math.pow(D.hz / W.hz, through), through };
}
