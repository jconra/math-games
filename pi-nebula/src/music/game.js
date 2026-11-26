// THE MUSIC IN THE GAME: one song for the whole station, heard as the place the crew member is in sounds (src/music/
// rooms.js), aboard the ships too, and the arena's own song in the arena. Loaded only when the music is on
// (src/music/switch.js); nothing here makes a sound before the player has touched the page (src/sound.js).
//   - it plays through the game's sound player's 'music' volume group, so the HUD's mute and volume rule it (muted,
//     no notes are made at all: src/music/player.js);
//   - each different note pre-rendered in the background (src/music/bake.js), kept between visits; one not ready yet
//     plays live;
//   - the room: eased as they walk from one into the next (the player's M.room, about a second); aboard any ship, in
//     its hangar and out on a run, a small cabin; on foot off any ship and off the station (a planet, the old station)
//     it fades out, and no notes are made until they are back aboard, where it fades in again;
//   - the arena: its own song (Mathball Drop to begin with) in place of the station's, changed over on the next bar
//     as they go in and as they come out, each from its top; each song kept in this browser on its own
//     ('pi-nebula.music.station', 'pi-nebula.music.arena': the screens change them, src/music/places.js);
//   - quieter under talking (a voice clip, a station announcement) and while a math card is up (rooms.js QUIET);
//   - its work on the main thread is the scheduler's tick (every 60 ms, a bar's notes when one is due) and this
//     file's look round, four times a second; while the page is hidden no notes are made (the player's `rests`).
//
//   const G = startGameMusic({ sound, notes })     notes: 'baked' (pre-rendered) or 'live'
//   G.update(dt, where)   each frame; where: () => { zone, ship, ground } (src/music/rooms.js hearing), asked only
//                         when it looks round
//   G.music               the music player; G.state() for the rigs
//   G.which, G.settled    (MUSIC 3) the song playing here, 'station' or 'arena', and whether it has come in yet (a
//                         song switched to starts on the next bar); G.settle() brings it in now (a screen opened)
//   G.edit(song)          (MUSIC 3) a screen changed the song playing here: kept as that place's song
import { createMusic } from './player.js';
import { cleanSong, checkSong } from './song.js';
import { SOUNDS, SONGS, hearing, quiet } from './rooms.js';

const KEEP = { station: 'pi-nebula.music.station', arena: 'pi-nebula.music.arena' };
const LOOK = 0.25, GONE = 2;      // (s: how often it looks round; how long after fading out it stops making notes)

function kept(which) {
  try {
    const v = JSON.parse(localStorage.getItem(KEEP[which]) || 'null');
    if (v && !checkSong(cleanSong(v)).length) return cleanSong(v);
  } catch (e) { /* blocked: the song to begin with */ }
  return { ...SONGS[which] };
}

export function startGameMusic({ sound, notes = 'baked' } = {}) {
  const music = createMusic({ sound, notes, rests: true });
  const songs = { station: kept('station'), arena: kept('arena') };
  let which = 'station', kind = null, heard = true, goneT = 0, t = LOOK, hush = 1, started = false, card = false;
  music.set(songs.station);
  const G = {
    music,
    update(dt, where) {
      // (the first moment sound can play: the music starts, the station's song first to be rendered, then the arena's)
      if (!started) {
        if (!sound.ready) return;
        started = true; music.play(); if (music.notes === 'baked') music.prepare(songs.arena);
      }
      if ((t += dt) < LOOK) return;
      t = 0;
      const w = typeof where === 'function' ? where() : where;
      const h = hearing({ ...(w || {}), last: kind });
      if (h.song !== which) { which = h.song; music.switchTo(songs[which]); }
      if (h.heard) {
        if (!heard) { heard = true; music.hold(false); kind = null; }
        goneT = 0;
        if (h.kind !== kind) { kind = h.kind; music.room(SOUNDS[kind]); }
      } else {
        if (heard) { heard = false; music.room({ ...(SOUNDS[kind] || SOUNDS.cabin), level: 0 }); }
        if ((goneT += LOOK) >= GONE) music.hold(true);
      }
      card = typeof document !== 'undefined' && !!document.querySelector('.pnj:not(.is-going)');
      const q = quiet({ talking: sound.playing('voices') + sound.playing('station') > 0, card });
      if (q !== hush) { hush = q; music.hush(q); }
    },
    // (MUSIC 3: the screens. Which song is playing here (the arena's or the station's), and whether it has come in yet:
    // a song switched to plays from the next bar, until then the one before is heard)
    get which() { return which; },
    get settled() { return JSON.stringify(music.song) === JSON.stringify(songs[which]); },
    // a screen opened before the song switched to has come in: it plays from the next bar not yet made instead
    settle() { if (!G.settled) music.set({ ...songs[which] }); },
    // a change made on a screen (to the song playing here, music.set already done): kept as that place's song
    edit(song) {
      songs[which] = { ...song };
      try { localStorage.setItem(KEEP[which], JSON.stringify(songs[which])); } catch (e) { /* not kept */ }
    },
    state: () => ({ which, kind, heard, hush, card, song: music.song.name, playing: music.playing, notes: music.notes, stats: { ...music.stats }, bakery: music.bakery ? music.bakery.stats() : null, place: music.roomNow }),
  };
  return G;
}
