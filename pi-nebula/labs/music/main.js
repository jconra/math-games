// THE MUSIC LAB: the station's music (src/music/), and its control screen full page, to hear before any of it goes
// into the game. The game's maker, 2026-11-24: "Btw we should work on some music too ... We might want to make a lab
// for it." The screen is the game's own module (src/music/screen.js), with the "Heard in" row the lab has and a
// station wall will not. The music plays by itself here (its own audio context, made on the first Play).
import { createMusic } from '../../src/music/player.js';
import { mountMusicScreen } from '../../src/music/screen.js';

const music = createMusic();
const screen = mountMusicScreen(document.getElementById('screen'), music, { heardIn: true, keep: 'pi-nebula.music-lab' });
// (the rigs: the music and its screen)
window.MUSIC = { music, screen };
