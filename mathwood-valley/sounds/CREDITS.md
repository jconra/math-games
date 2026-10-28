# Animal sounds: credits

The recorded animal and bird clips in this folder. Every one is CC0 or public domain (attribution is not required; it is
given here as a courtesy). Each comes as `.ogg` (Ogg Vorbis) and `.m4a` (AAC, for Safari, which can't play Ogg); the game
loads whichever the browser can play (src/audio/ambience.js). Each was trimmed, faded at both ends and evened in loudness
(about -18 LUFS) from the source recording; a few loud-cracking ones went through a gentle limiter, and the far herd
through a low-pass so it sounds far off. Everything else the game sounds like (hooves,
hammering, sawing, the creek, a pig's grunt, the music) is made in the browser, no recordings. The voice clips in voice/ (the player's hyah, whoa, yeehaw,
howdy and the rest, and the men's thank-yous, the bandits' lines and the store customers' words) were recorded by the
game's maker. So were the read-aloud clips in read/ (the numbers 0 to 20, the tens, the tens and ones cut from numbers
like "thirty-two", "one hundred" and "and", the card words such as "what comes after", "take away" and "how many
dots?", and "That's right!", "Not that one." and "Count 'em again."): src/audio/readaloud.js joins them into each
Counting, Adding and Taking away card's line. Each was cut tight, had the rumble below 90 Hz taken off, was faded at
both ends and evened to about -18 LUFS (a gentle peak limiter keeps them under -1.5 dBFS), and is mono, 44.1 kHz,
.ogg and .m4a like the rest.

| file | what | source | author | licence |
|---|---|---|---|---|
| `bird_crow_1` | a crow | https://bigsoundbank.com/carrion-crow-2-s3462.html | Le tiroir du fond | CC0 |
| `bird_crow_2` | a crow | https://commons.wikimedia.org/wiki/File:American_Crow.ogg | G McGrane | Public domain (Wikimedia Commons) |
| `bird_hawk` | a hawk | https://commons.wikimedia.org/wiki/File:Red-shouldered_Hawk.ogg | G. McGrane | Public domain (Wikimedia Commons) |
| `bird_meadowlark_1` | a western meadowlark | https://www.nps.gov/yell/learn/photosmultimedia/sounds-westernmeadowlark.htm | NPS & MSU Acoustic Atlas/Jennifer Jerrett | Public domain (US Government work, NPS) |
| `bird_meadowlark_2` | a western meadowlark | https://www.nps.gov/yell/learn/photosmultimedia/sounds-westernmeadowlark.htm | NPS & MSU Acoustic Atlas/Jennifer Jerrett | Public domain (US Government work, NPS) |
| `bird_raven_1` | a raven | https://www.nps.gov/yell/learn/photosmultimedia/sounds-raven.htm | NPS/David Restivo | Public domain (US Government work, NPS) |
| `bird_raven_2` | a raven | https://www.nps.gov/yell/learn/photosmultimedia/sounds-raven.htm | NPS/David Restivo | Public domain (US Government work, NPS) |
| `chicken_hen_clucks` | a hen clucking | https://bigsoundbank.com/hen-lays-2-s0976.html | Joseph SARDIN | CC0 |
| `chicken_hen_squawk` | a hen squawking (one scattering) | https://bigsoundbank.com/annoyed-hen-s0453.html | Joseph SARDIN | CC0 |
| `chicken_rooster` | a rooster crowing | https://bigsoundbank.com/song-of-rooster-s0283.html | DenisChardonnet | CC0 |
| `cow_herd_distant` | a herd lowing, heard from far off | https://bigsoundbank.com/barn-with-cows-2-s0992.html | Joseph SARDIN | CC0 |
| `cow_moo_1` | a cow mooing (every cow says it, at its own pitch) | https://bigsoundbank.com/cow-moos-3-s2383.html | Joseph SARDIN | CC0 |
| `dog_bark_1` | a dog barking (the shiba and the husky) | https://bigsoundbank.com/old-dog-barking-2-s2353.html | Joseph SARDIN | CC0 |
| `dog_bark_rare` | a dog barking (now and then only) | https://bigsoundbank.com/barking-dog-3-s2955.html | Joseph SARDIN | CC0 |
| `dog_husky_howl` | a husky howling | https://bigsoundbank.com/pack-of-dogs-s2953.html | Joseph SARDIN | CC0 |
| `dog_husky_talk` | a husky "talking" | https://bigsoundbank.com/dog-singing-1-s2450.html | Joseph SARDIN | CC0 |
| `dog_woof` | a small dog barking (the pug) | https://bigsoundbank.com/small-dog-barking-s0612.html | Joseph SARDIN | CC0 |
| `horse_snort` | a horse snorting | https://bigsoundbank.com/breath-of-a-horse-2-s0286.html | DenisChardonnet | CC0 |
| `horse_whinny_1` | a horse whinnying | https://bigsoundbank.com/horse-neighing-3-s0863.html | Joseph SARDIN | CC0 |
| `horse_whinny_2` | a horse whinnying | https://bigsoundbank.com/neighing-of-a-horse-1-s0284.html | DenisChardonnet | CC0 |
| `sheep_baa_1` | a sheep | https://opengameart.org/content/sheep-baa | AntumDeluge (from a recording by mikewest) | CC0 (OpenGameArt.org) |
| `sheep_baa_2` | a sheep | https://commons.wikimedia.org/wiki/File:Sheep_bleating.ogg | earthcalling | Public domain (Wikimedia Commons) |
| `sheep_baa_3` | a sheep | https://bigsoundbank.com/sheep-2-s2344.html | Joseph SARDIN | CC0 |

## The fiddle (fiddle/)

The saloon band's fiddle: `fiddle/fiddle_<note>.ogg|.m4a`, twelve notes from G3 to E6 (G, A, C and E of each octave). They
are the solo violin's held notes with vibrato, played loud (`Strings/Solo Violin/Arco Vib/LLVln_ArcoVib_<note>_f.wav`), from
**VSCO 2 Community Edition** by Versilian Studios (https://github.com/sgossner/VSCO-2-CE), released under **CC0 1.0**
(checked 2026-10-28: the repository's LICENSE file is the CC0 1.0 Universal text). Each was made mono, trimmed to its
first 2.8 s with a fade at the end, and evened in loudness (about -20 dB RMS over its held part). The game plays each
one a little faster or slower for the notes between (src/audio/stagemusic.js FIDDLE_SAMPLES).

Notes on the licences (from the source pages, checked 2026-10-13):

- BigSoundBank (Joseph SARDIN and contributors): each sound page says "License CC0 (public domain): Free and royalty-free".
- US National Park Service (Yellowstone Sound Library): "The files available here were recorded in the park and are in the
  public domain. They may be downloaded and used without limitation; however, please credit the 'National Park Service'
  where appropriate."
- Wikimedia Commons: public domain or CC0 as stated in each file page's licence box.
- OpenGameArt.org: CC0 as stated on the page.
