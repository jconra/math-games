// The music in the game (src/music/bake.js, rooms.js, switch.js, game.js; the player's own switches): its plain parts.
// The game's maker, 2026-11-24: "Do we need to sample all the notes we need so the audio context doesn't have a hard
// time processing the sounds in real time?", and of the station: "same sound everywhere ... louder in some areas, or
// even had more reverb in the hangers", "the ships should have access to the music too".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRESETS, formOf } from '../src/music/song.js';
import { barBlock, FORMS, SECTION } from '../src/music/patterns.js';
import { TECHNO_PATCHES } from '../src/music/patches.js';
import { notePatch, setFor } from '../src/music/player.js';
import { noteKey, patchHash, worth, bakedSecs, bakedPatch, noisy, costOf, BAKE, hashText } from '../src/music/bake.js';
import { SOUNDS, STATION_ROOMS, QUIET, SONGS, hearing, quiet } from '../src/music/rooms.js';
import { musicWanted, MUSIC_KEY } from '../src/music/switch.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const P = (name) => TECHNO_PATCHES['TECHNO — ' + name];
const note = (patch, o) => notePatch(patch, { ...o, gain: 1 });
const SR = 48000;

test('a note\'s key: the patch\'s content, its pitch, its length where the patch holds notes, its own settings; never its level', () => {
  const pad = P('WARM PAD'), kick = P('KICK'), wob = P('WOBBLE BASS');
  const k = (p, o, take = 0) => noteKey(p, o, SR, take);
  assert.equal(k(pad, { semi: 3, len: 2 }), k(pad, { semi: 3, len: 2 }));
  assert.notEqual(k(pad, { semi: 3, len: 2 }), k(pad, { semi: 4, len: 2 }), 'pitch');
  assert.notEqual(k(pad, { semi: 3, len: 2 }), k(pad, { semi: 3, len: 2.5 }), 'length of a held note');
  assert.equal(k(kick, { semi: 0, len: 0.1 }), k(kick, { semi: 0, len: 0.9 }), 'a drum\'s length is the drum: the same key at any length');
  assert.notEqual(k(wob, { semi: 0, len: 1, set: { 'w-lfo': { freq: 2 } } }), k(wob, { semi: 0, len: 1, set: { 'w-lfo': { freq: 4 } } }), 'the wobble\'s speed');
  assert.notEqual(k(kick, {}, 0), k(kick, {}, 1), 'the take');
  assert.notEqual(noteKey(kick, {}, 48000), noteKey(kick, {}, 44100), 'the sample rate');
  // (the same content in another object: the same key; one number changed, as a patch tuned in the Sound Lab and synced: another)
  const copy = JSON.parse(JSON.stringify(pad));
  assert.equal(k(copy, { semi: 3, len: 2 }), k(pad, { semi: 3, len: 2 }));
  const tuned = JSON.parse(JSON.stringify(pad)); tuned.nodes.find((n) => n.type === 'filter').freq += 1;
  assert.notEqual(k(tuned, { semi: 3, len: 2 }), k(pad, { semi: 3, len: 2 }));
  assert.notEqual(patchHash(tuned), patchHash(pad));
  assert.equal(hashText('abc'), hashText('abc')); assert.notEqual(hashText('abc'), hashText('abd'));
});

test('a note is rendered at full level: velocity (and so a part\'s level) is put on at play time, never in it', () => {
  for (const [name, patch] of Object.entries(TECHNO_PATCHES)) {
    const soft = bakedPatch(notePatch(patch, { semi: 2, gain: 0.3, len: 0.5 })), loud = bakedPatch(notePatch(patch, { semi: 2, gain: 1, len: 0.5 }));
    assert.deepEqual(soft.patch, loud.patch, name + ': the rendered patch does not change with the level');
    assert.ok(Math.abs(soft.out / loud.out - 0.3) < 1e-9, name + ': the level is the out\'s');
    if (loud.send) assert.ok(Math.abs(soft.send / loud.send - 0.3) < 1e-9, name + ': and the send\'s');
    assert.equal(loud.patch.nodes.find((n) => n.type === 'out').gain, 1);
  }
});

test('what goes to the room: one channel where it is a share of what goes out, a second of its own where not', () => {
  assert.equal(bakedPatch(note(P('CLAP'), {})).apart, false);
  assert.equal(bakedPatch(note(P('WARM PAD'), { len: 2 })).apart, false);
  assert.ok(!bakedPatch(note(P('WARM PAD'), { len: 2 })).patch.nodes.some((n) => n.type === 'send'), 'a share: no send in the render');
  for (const n of ['SNARE', 'KEYS', 'BELLS', 'ECHO PLUCK']) {
    const b = bakedPatch(note(P(n), { len: 1 }));
    assert.equal(b.apart, true, n); assert.equal(b.patch.nodes.find((x) => x.type === 'send').gain, 1, n);
  }
  assert.equal(bakedPatch(note(P('KICK'), {})).send, 0, 'no send: nothing to the room');
});

test('what is pre-rendered is decided by a note\'s length and cost, not its name (a patch never seen is decided the same)', () => {
  // every drum, bass and lead note of the presets, the long pads and the wobble: rendered
  for (const n of ['KICK', 'HEAVY KICK', 'SNARE', 'HAT', 'OPEN HAT', 'CLAP', 'TOM', 'PULSE BASS', 'WOBBLE BASS', 'FM LADDER BASS', 'ARP', 'BELLS', 'KEYS'])
    assert.ok(worth(note(P(n), { len: 0.5 })), n);
  for (const n of ['WARM PAD', 'AIRY PAD', 'DARK PAD']) assert.ok(worth(note(P(n), { len: 3 })), n + ': a bar and a half');
  // a note longer than BAKE.most of samples (its length times its takes) plays live; noise has three takes
  const padLen = (secs) => secs - (bakedSecs(note(P('WARM PAD'), { len: 3 })) - 3);
  assert.equal(worth(note(P('WARM PAD'), { len: padLen(BAKE.most + 0.5) })), false, 'too long a pad');
  assert.ok(noisy(P('RISER')) && !noisy(P('WARM PAD')));
  assert.equal(worth(note(P('RISER'), { len: BAKE.most / BAKE.takes + 0.5 })), false, 'a long riser: three takes of it');
  // a patch nobody has written yet, never seen here: a long slow pad with next to nothing in it plays live (cheaper so),
  // a busy one of the same length is rendered; a drone (no envelope: no end) never
  const made = (extra) => ({ name: 'New', kind: 'instrument', dur: 4, nodes: [{ id: 'o', type: 'osc', wave: 'sine', freq: 261.6 }, { id: 'e', type: 'env', attack: 1, decay: 1, sustain: 0.8, release: 0.6 }, { id: 'g', type: 'gain' }, ...extra, { id: 'out', type: 'out', gain: 0.5 }],
    cables: [{ from: 'o', to: 'g' }, { from: 'e', to: 'g', port: 'gain' }, { from: 'g', to: 'out' }] });
  const thin = note(made([]), { len: 4.5 }), busy = note(made(Array.from({ length: 4 }, (_, i) => ({ id: 'f' + i, type: 'filter', ftype: 'lowpass', freq: 3000 })).concat([])), { len: 4.5 });
  assert.ok(bakedSecs(thin) > BAKE.short && bakedSecs(thin) <= BAKE.most);
  assert.equal(costOf(thin) >= BAKE.perSec * bakedSecs(thin), worth(thin), 'decided by nodes a second');
  const drone = { name: 'Drone', dur: 2, nodes: [{ id: 'o', type: 'osc', freq: 100 }, { id: 'out', type: 'out', gain: 1 }], cables: [{ from: 'o', to: 'out' }] };
  assert.equal(worth(drone), false, 'a drone never');
  assert.equal(typeof worth(busy), 'boolean');
  // and the rule's code names no patch
  const code = read('src/music/bake.js').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.doesNotMatch(code, /TECHNO —|'PAD'|WOBBLE/);
});

test('the presets as the game plays them: at least 99 % of their notes pre-rendered, in a few MB', () => {
  for (const Pr of PRESETS) {
    const S = Pr.song, sd = 60 / S.bpm / 4, bars = SECTION * (1 + FORMS[formOf(S)].loop.length);
    let all = 0, yes = 0; const keys = new Map();
    for (let b = 0; b < bars; b++) for (const tr of barBlock(S, b).tracks) for (const n of tr.notes) {
      const patch = TECHNO_PATCHES[tr.inst], secs = Math.max(0.05, n[2] * sd), o = { semi: n[1], len: secs, set: setFor(tr.inst, n, sd, secs) };
      const nt = note(patch, o), w = worth(nt); all++; if (w) yes++;
      if (w) keys.set(noteKey(patch, o, SR), bakedSecs(nt) * (noisy(nt) ? BAKE.takes : 1) * (bakedPatch(nt).apart ? 2 : 1));
    }
    const MB = [...keys.values()].reduce((a, s) => a + s * SR * 4, 0) / 1048576;
    assert.ok(yes / all >= 0.99, `${Pr.name}: ${yes} of ${all}`);
    assert.ok(MB < 24, `${Pr.name}: ${MB.toFixed(1)} MB`);
  }
});

test('the rooms\' table covers every room of the station\'s file; every place that can be stood in has a sound', () => {
  const R = JSON.parse(read('kit/rooms/station.json')).rooms;
  for (const r of R) {
    assert.ok(Object.prototype.hasOwnProperty.call(STATION_ROOMS, r.id), r.id + ' (' + r.name + ') is in the table');
    if (r.probe) assert.ok(SOUNDS[STATION_ROOMS[r.id]], r.id + ': a room stood in has a sound');
    else assert.equal(STATION_ROOMS[r.id], null, r.id + ': a door or hatch keeps the room before');
  }
  for (const id of Object.keys(STATION_ROOMS)) assert.ok(R.some((r) => r.id === id), id + ' is a room of the station');
  for (const [k, s] of Object.entries(SOUNDS)) {
    assert.ok(s.level >= 0 && s.level <= 1.5 && s.reverb >= 0 && s.reverb <= 1 && s.size >= 0 && s.size <= 1, k);
  }
  // as asked: quarters soft and nearly dry; the hangars biggest, the longest echo; Cargo and the smelter big; medical soft
  const S = (id) => SOUNDS[STATION_ROOMS[id]];
  assert.ok(S('quarters').reverb <= 0.1 && S('quarters').level < S('c1').level);
  for (const k of Object.keys(SOUNDS)) if (k !== 'hangar') { assert.ok(SOUNDS.hangar.size >= SOUNDS[k].size && SOUNDS.hangar.reverb >= SOUNDS[k].reverb, k); }
  for (const id of ['hangar-miner', 'hangar', 'hangar-medic']) assert.equal(STATION_ROOMS[id], 'hangar');
  for (const id of ['store', 'smelter-hall']) assert.ok(S(id).size > S('c1').size && S(id).reverb > S('c1').reverb, id);
  assert.ok(S('medical').level < S('terminal').level);
});

test('where it is heard, and which song: the arena its own, the ships a small cabin, off any ship out there not at all', () => {
  assert.deepEqual(hearing({ zone: 'quarters' }), { heard: true, kind: 'quarters', song: 'station' });
  assert.equal(hearing({ zone: 'hangar' }).kind, 'hangar');
  assert.deepEqual(hearing({ zone: 'arena' }), { heard: true, kind: 'arena', song: 'arena' });
  // aboard a ship: parked in its hangar, or out on a run (its rooms as parked), a small cabin, the station's song
  assert.deepEqual(hearing({ zone: 'hangar-miner', ship: 'miner/cockpit' }), { heard: true, kind: 'cabin', song: 'station' });
  assert.deepEqual(hearing({ zone: null, ship: 'hauler/hold' }), { heard: true, kind: 'cabin', song: 'station' });
  // on foot off any ship and off the station: not heard (and back aboard it is)
  assert.equal(hearing({ zone: null, ship: 'medic/bay', ground: true }).heard, false);
  assert.equal(hearing({ zone: null, ship: null, ground: true, last: 'cabin' }).heard, false);
  // a door, or between rooms: the room before is kept (the arena's song too, out through its own door)
  assert.equal(hearing({ zone: 'door-arena', last: 'arena' }).song, 'arena');
  assert.equal(hearing({ zone: 'hatch-medic', last: 'hangar' }).kind, 'hangar');
  assert.equal(hearing({ zone: null, last: 'terminal' }).kind, 'terminal');
  assert.equal(hearing({ zone: 'c2', last: 'arena' }).song, 'station', 'out in the corridor: the station\'s song again');
  assert.equal(hearing({}).kind, 'corridor', 'nowhere known yet');
  // the songs to begin with: Night Shift for the station (chill), Mathball Drop for the arena (heavy)
  assert.equal(SONGS.station.name, 'Night Shift'); assert.equal(formOf(SONGS.station), 'flow');
  assert.equal(SONGS.arena.name, 'Mathball Drop'); assert.equal(formOf(SONGS.arena), 'drop');
});

test('quieter under talking and math cards: two numbers, in one place', () => {
  assert.equal(quiet({}), 1);
  assert.equal(quiet({ talking: true }), QUIET.talking);
  assert.equal(quiet({ card: true }), QUIET.card);
  assert.equal(quiet({ talking: true, card: true }), Math.min(QUIET.talking, QUIET.card));
  assert.ok(QUIET.talking > 0.3 && QUIET.talking < 1 && QUIET.card > 0.3 && QUIET.card < 1, 'a little, never silent');
  assert.deepEqual(Object.keys(QUIET).sort(), ['card', 'talking']);
});

test('the music only when asked for: ?music=1 on and remembered, ?music=0 off, neither as remembered (off at first)', () => {
  const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
  const s = store();
  assert.equal(musicWanted('', s).on, false, 'off at first');
  assert.equal(s.m.size, 0, 'nothing written without asking');
  assert.equal(musicWanted('?music=1', s).on, true);
  assert.equal(s.m.get(MUSIC_KEY), '1');
  assert.equal(musicWanted('?q=low', s).on, true, 'remembered');
  assert.equal(musicWanted('?music=0', s).on, false);
  assert.equal(musicWanted('', s).on, false, 'off remembered');
  assert.equal(musicWanted('?music=1', s).notes, 'baked');
  assert.equal(musicWanted('?music=1&notes=live', s).notes, 'live');
  assert.equal(musicWanted('', null).on, false, 'no store');
  // the game's page loads the music's code only when it is on (one dynamic import, after asking)
  const main = read('src/main.js');
  assert.doesNotMatch(main, /^import .*music\/(game|player|bake)/m);
  assert.match(main, /if \(want\.on\) import\('\.\/music\/game\.js'\)/);
});

test('the pre-rendering plays only what the engine rendered: no oscillator of its own, nothing from outside pi-nebula', () => {
  for (const f of ['src/music/bake.js', 'src/music/game.js', 'src/music/rooms.js', 'src/music/switch.js']) {
    const code = read(f).split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    assert.doesNotMatch(code, /createOscillator|createConstantSource|createBiquadFilter/, f);
    assert.doesNotMatch(code, /from '\.\.\/\.\.\/\.\.\//, f);
    assert.doesNotMatch(code, /mathwood/i, f + ': copied, not imported');
  }
  assert.match(read('src/music/bake.js'), /playPatch\(oc,/, 'each note rendered by the engine\'s own playPatch');
});
