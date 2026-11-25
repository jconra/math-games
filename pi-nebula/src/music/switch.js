// IS THE MUSIC ON IN THE GAME? Only when asked for, until the station's screens that control it are made: `?music=1`
// in the game's address turns it on and `?music=0` off, and either is remembered in this browser
// ('pi-nebula.music.on'); with neither it is as remembered, and off at first, so the game is exactly as it was: none
// of the music's code is even loaded (src/main.js loads src/music/game.js only when this says yes).
//   `?notes=live` (not remembered: for trying it) every note made live, as the Music Lab's "Live"; otherwise each
//   different note is pre-rendered (src/music/bake.js).
//   musicWanted(search, store) -> { on, notes }      (search: the address's ?..., store: localStorage or a stand-in)
export const MUSIC_KEY = 'pi-nebula.music.on';

export function musicWanted(search = '', store = null) {
  const q = new URLSearchParams(search), v = q.get('music');
  let on = false;
  try { on = store ? store.getItem(MUSIC_KEY) === '1' : false; } catch (e) { /* blocked: off */ }
  if (v === '1' || v === '0') {
    on = v === '1';
    try { if (store) store.setItem(MUSIC_KEY, v); } catch (e) { /* not kept */ }
  }
  return { on, notes: q.get('notes') === 'live' ? 'live' : 'baked' };
}
