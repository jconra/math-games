// THE STATION'S VOICES (2026-11-16; the game's maker: "We should also get voices from Eleven Labs for simple
// greetings"). Six voices designed with ElevenLabs' voice design (each from a few words on who they are; kept in the
// account by these names), and the short clips each says (assets/sound/voices/<clip>.mp3: trimmed, levelled, one
// channel; ~/pw/space-math/rigs/station-life-2/voices/make.sh). Never the browser's own speech.
//
// A person's voice is set in the roster (life.js `voice`, and `rate`: played a little higher and quicker, or lower
// and slower, so two people sharing a voice are told apart). The words of each clip are what its bubble says, so a
// clip and its bubble always match; a line with no clip is a bubble alone.
//
// TO ADD A CLIP: make it with the same voice (ElevenLabs, the voice's name below), run it through make.sh, and list it
// here; a voice's `hellos` are the clips its people say when they first greet the player.
export const VOICES = {
  vega: { name: 'Pi Nebula Vega', who: 'Captain Vega: a warm, bright woman in her thirties, clear and calm, a smile in it', hellos: ['vega-hello'] },
  ruiz: { name: 'Pi Nebula Ruiz', who: 'Captain Ruiz: a hearty, friendly man in his early thirties, warm and a little gravelly', hellos: ['ruiz-hello'] },
  hale: { name: 'Pi Nebula Hale', who: 'Captain Hale: a kind, gentle woman in her late sixties, calm and reassuring', hellos: ['hale-hello'] },
  yw: { name: 'Pi Nebula Crew Young Woman', who: 'a cheerful young woman in her early twenties, bright and friendly', hellos: ['yw-hi', 'yw-hello', 'yw-going', 'yw-hiya'] },
  ym: { name: 'Pi Nebula Crew Young Man', who: 'a friendly young man in his early twenties, light and upbeat', hellos: ['ym-hey', 'ym-hithere', 'ym-hello'] },
  om: { name: 'Pi Nebula Crew Older Man', who: 'a warm, easy-going man in his late fifties, a little gravelly', hellos: ['om-hello', 'om-heythere', 'om-good', 'om-welcome'] },
};
export const CLIPS = {
  'vega-hello': { voice: 'vega', words: 'Hello there!' },
  'vega-pitch': { voice: 'vega', words: 'Hi! I\'m Captain Vega of the starship Explorer. I\'m putting a crew together to visit new worlds. Interested?' },
  'vega-ready': { voice: 'vega', words: 'Wonderful! Come and find me when you\'re ready.' },
  'ruiz-hello': { voice: 'ruiz', words: 'Hey there!' },
  'ruiz-pitch': { voice: 'ruiz', words: 'Hey! I\'m Captain Ruiz of the Miner. I need crew for a mining run. Interested?' },
  'ruiz-ready': { voice: 'ruiz', words: 'Great! Come find me when you\'re ready.' },
  'hale-hello': { voice: 'hale', words: 'Hello, dear.' },
  'hale-pitch': { voice: 'hale', words: 'Hello! I\'m Captain Hale of the Medic. We need crew for a rescue mission. Interested?' },
  'hale-ready': { voice: 'hale', words: 'Wonderful. Come and find me when you\'re ready.' },
  'yw-hi': { voice: 'yw', words: 'Hi!' },
  'yw-hello': { voice: 'yw', words: 'Hello!' },
  'yw-going': { voice: 'yw', words: 'Hey, how\'s it going?' },
  'yw-hiya': { voice: 'yw', words: 'Hiya!' },
  'ym-hey': { voice: 'ym', words: 'Hey!' },
  'ym-hithere': { voice: 'ym', words: 'Hi there!' },
  'ym-hello': { voice: 'ym', words: 'Hello!' },
  'om-hello': { voice: 'om', words: 'Hello.' },
  'om-heythere': { voice: 'om', words: 'Hey there.' },
  'om-good': { voice: 'om', words: 'Good to see you.' },
  'om-welcome': { voice: 'om', words: 'Welcome aboard.' },
};
export const clipUrl = (id) => new URL('../assets/sound/voices/' + id + '.mp3', import.meta.url).href;
