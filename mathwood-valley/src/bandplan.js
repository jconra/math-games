// THE BAND'S PLAN: the plain parts of the saloon's band (src/stage.js), with no three.js in them, so the tests can read
// them: what the band card offers, which key picks what, what the players say, how long a song goes on and which one
// comes next, and how the music from the stage reaches the ears through the saloon's walls and doorways.
//
//   bandChoices({ song, resting, songs }) -> rows   the card's rows, in order: [{ id, label, sub, key, keyName, on, group }]
//                     id: a song's id, 'break' or 'again'; key: the KeyboardEvent.code that picks it; on: the song
//                     playing now; group: 'own' (the band's own songs) or 'old' (the old fiddle tunes) for a song.
//                     Playing: the songs, then "Take a break". Resting: "Play again" (the song they stopped on), then
//                     the songs. The keys: 1 to 9, then 0 and - (the number row along), B, Enter
//   choiceForKey(rows, code) -> the row a key picks (or null)
//   bandLine(what, song) -> the words in the speech bubble ('song' | 'again' | 'break' | 'same' | 'next')
//   songLines(song, { intro, rand }) -> how many lines (four bars each, the opening line counted) the band plays it
//                     before finishing: a written tune (song.round) to the end of a round, two or three times round
//                     (more for a short one); a made-up one at the end of a line after about two or three minutes
//   nextSong({ songs, played, rand }) -> the song to play next on its own: not one of the last two played, the band's
//                     own and the old tunes in a fair mix (each side about as often), the ones not heard lately likelier
//   soundThrough({ inside, ways }) -> { gain, hz }   how the band is heard where the ears are. inside: the ears in the
//                     saloon's hall (full and open). Else through the walls (quiet and muffled), and through each
//                     doorway way { open (0..1: how far its doors stand open; no door, or the batwings resting open,
//                     is 1), dist (m from the doorway's middle), facing (-1..1: straight out in front of it is 1,
//                     along the wall 0) }: more of the band, and brighter, standing near a doorway and in front of it
//   BAND               the dials
import { SONGS } from './audio/stagemusic.js';

export const BAND = {
  wall: { gain: 0.29, hz: 650 },     // through the walls: this much of the band, its highs gone above hz
  door: { gain: 0.9, hz: 9000 },     // through a doorway right in front of it
  doorNear: 3, doorFar: 45,          // m from a doorway: all of what comes through it within doorNear, none past doorFar
                                     // (out in front of the open batwings the band carries a long way down the street)
  sideways: 0.3,                     // how much a doorway still gives standing beside it (along the wall) to one square in front ...
  sideNear: 12,                      // ... close by: gone by this many metres off (further off only in front of it carries)
  // how long a song goes on before the band finishes it: about this many seconds (a dice throw between the two); a
  // written tune to the end of a round, at least twice round
  length: { secs: [120, 180], rounds: 2 },
  // the next song on its own: the share of picks from the other side (the band's own / the old tunes) to the one just
  // played; the songs not played in the last `lately` count this much more
  mix: { other: 0.6, lately: 6, fresh: 2.5 },
};

// the number row along: 1 .. 9, 0, then the key after it (-)
const SONG_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'];
const KEY_NAMES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

export function bandChoices({ song = null, resting = false, songs = SONGS } = {}) {
  const now = songs.find((s) => s.id === (song && song.id ? song.id : song)) || songs[0];
  const list = songs.map((s, i) => ({ id: s.id, label: s.name, sub: s.feel || '', key: SONG_KEYS[i] || null, keyName: KEY_NAMES[i] || null, on: !resting && s.id === now.id, group: groupOf(s) }));
  if (resting) return [{ id: 'again', label: 'Play again', sub: now.name, key: 'Enter', keyName: 'Enter' }, ...list];
  return [...list, { id: 'break', label: 'Take a break', sub: 'the band rests', key: 'KeyB', keyName: 'B' }];
}

// a song's side of the card: as the song says (group), else a written tune (it has a round) is one of the old fiddle
// tunes and the rest the band's own
export const groupOf = (s) => (s && (s.group || (s.round ? 'old' : 'own')));

export function choiceForKey(rows, code) {
  if (!code) return null;
  const k = code === 'NumpadEnter' ? 'Enter' : code === 'NumpadSubtract' ? 'Minus' : /^Numpad\d$/.test(code) ? 'Digit' + code.slice(6) : code;
  return rows.find((r) => r.key === k) || null;
}

export function bandLine(what, song) {
  if (what === 'break') return "We'll rest our hands a spell.";
  if (what === 'again') return `Back to it: ${song.name}!`;
  if (what === 'same') return `${song.name}, from the top!`;
  if (what === 'next') return `Next up: ${song.name}!`;
  return song.ask || `${song.name} it is!`;
}

export function songLines(song, { intro = true, rand = Math.random } = {}) {
  const L = BAND.length, secs = L.secs[0] + (L.secs[1] - L.secs[0]) * rand(), line = song.beat * song.bar * 4;
  if (song.round) {
    const rounds = Math.max(L.rounds, Math.round(secs / (song.round * line)));
    return (intro ? 1 : 0) + rounds * song.round;
  }
  return Math.max(2, Math.ceil(secs / line));
}

export function nextSong({ songs = SONGS, played = [], rand = Math.random } = {}) {
  const last = played.length ? played[played.length - 1] : null, lastSong = songs.find((s) => s.id === last);
  const out = new Set(played.slice(-2));
  let pool = songs.filter((s) => !out.has(s.id));
  if (!pool.length) pool = songs.filter((s) => s.id !== last);
  if (!pool.length) return songs[0];
  // which side: the other one from the song just played, more often than not (so the band's four and the seven old
  // tunes come round about as often as each other)
  const M = BAND.mix, sides = { own: pool.filter((s) => groupOf(s) === 'own'), old: pool.filter((s) => groupOf(s) === 'old') };
  let side = lastSong ? (rand() < M.other ? (groupOf(lastSong) === 'own' ? 'old' : 'own') : groupOf(lastSong)) : (rand() < 0.5 ? 'own' : 'old');
  if (!sides[side].length) side = side === 'own' ? 'old' : 'own';
  const lately = new Set(played.slice(-M.lately)), w = sides[side].map((s) => (lately.has(s.id) ? 1 : M.fresh));
  let x = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) return sides[side][i]; }
  return sides[side][sides[side].length - 1];
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (u) => { u = clamp01(u); return u * u * (3 - 2 * u); };
export function soundThrough({ inside = false, ways = [] } = {}) {
  if (inside) return { gain: 1, hz: 20000, through: 1 };
  let through = 0;
  for (const w of ways) {
    const near = 1 - smooth((w.dist - BAND.doorNear) / (BAND.doorFar - BAND.doorNear));
    const side = BAND.sideways * (1 - smooth((w.dist - BAND.doorNear) / (BAND.sideNear - BAND.doorNear)));
    const face = side + (1 - side) * clamp01(w.facing);
    through = Math.max(through, clamp01(w.open ?? 1) * near * face);
  }
  const W = BAND.wall, D = BAND.door;
  return { gain: W.gain + (D.gain - W.gain) * through, hz: W.hz * Math.pow(D.hz / W.hz, through), through };
}
