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
  // (Vega is a man, the game's maker's "his ship": ElevenLabs' built-in voice Eric, the account's own voices being full)
  vega: { name: 'Eric (ElevenLabs built-in, id cjVigY5qzO86Huf0OWal)', who: 'Captain Vega: a smooth, warm man\'s voice, calm and trustworthy', hellos: ['vega-hello'] },
  ruiz: { name: 'Pi Nebula Ruiz', who: 'Captain Ruiz: a hearty, friendly man in his early thirties, warm and a little gravelly', hellos: ['ruiz-hello'] },
  hale: { name: 'Pi Nebula Hale', who: 'Captain Hale: a kind, gentle woman in her late sixties, calm and reassuring', hellos: ['hale-hello'] },
  // (Captain Adair, the security captain: ElevenLabs' built-in voice Sarah, no other captain's; the account's own voices
  // are full)
  adair: { name: 'Sarah (ElevenLabs built-in, id EXAVITQu4vr4xnSDxMaL)', who: 'Captain Adair: a mature, confident woman, clear and reassuring', hellos: ['adair-hello'] },
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
  // (a contract signed with him: said, and then he walks to the Miner and waits by its lift)
  'ruiz-meet': { voice: 'ruiz', words: 'Glad to have you! I\'ll meet you at the ship.' },
  'hale-hello': { voice: 'hale', words: 'Oh, hello again!' },
  'hale-pitch': { voice: 'hale', words: 'Hello! I\'m Captain Hale of the Medic. We need crew for a rescue mission. Interested?' },
  'hale-ready': { voice: 'hale', words: 'Wonderful. Come and find me when you\'re ready.' },
  'adair-pitch': { voice: 'adair', words: 'Hi! I\'m Captain Adair, station security. My ship\'s down for maintenance for now. Come and find me later!' },
  'adair-hello': { voice: 'adair', words: 'Hello again! My ship\'s still in for repairs.' },
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

// THE SHIPS' OWN VOICES (2026-11-18; the game's maker: "we should get sounds for the ships too. Like a welcome message
// from the ship to the pilot when it gets turned on (a robotic "Welcome aboard pilot, Systems Ready") and a "Warning,
// pull up" message, and a "Reactor imbalance" voice for when you need to do the engineering questions. It would also be
// cool if the different ships had different sound clips."). Each ship speaks in its own voice, so each ship's clips are
// named by it: assets/sound/voices/ship-<ship>-<what>.mp3, beside the people's (as trimmed and levelled as they came;
// how the Miner's voice was made: ~/pw/elevenlabs/ship-voice/HOW.md). Heard in the cockpit, from everywhere
// (src/flying.js; when each is said: src/flymodel.js voiceStep). A ship with no clip for something says nothing.
//   welcome   as its power first comes on with someone newly in the seat
//   safety    again and again while it is in another ship's hangar ("it started saying "Safety Violation" over and
//             over in your cockpit")
// (Made and waiting for their own jobs, not in the game yet: ship-miner-pullup "Warning. Pull up." and
// ship-miner-reactor "Reactor imbalance.")
// THE THREE SHIP VOICES (the game's maker, 2026-11-19, of the tries he was sent): "we should use 3 for one ship, 4 for
// another, and 9_new_calm_goddess_3.mp3 for another": 3 is the Miner's own deep voice with a low buzz under it (the
// Miner's clips here, with the longer pause he asked for after "pilot."), 4 a giant rumbling being, 9 a calm woman.
// Which of the other two ships gets which is his to say; their clips are made and wait with the Miner's other two.
export const SHIP_CLIPS = {
  miner: { welcome: { id: 'ship-miner-welcome', words: 'Welcome aboard, pilot. Systems ready.' }, safety: { id: 'ship-miner-safety', words: 'Safety violation.' } },
};
