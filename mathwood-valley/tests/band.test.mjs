// The saloon band in plain numbers: the drummer's box parts (src/audio/stagemusic.js makeBoxPart: on the beat, each
// song's own feel, a waltz in three), his sounds (noise through filters, no tones), the old tunes left exactly as they
// were, and the band's card and its sound through the saloon's walls (src/bandplan.js). How it SOUNDS is for ears: the
// render rig ~/pw/bandit-math/rigs/band/render_band.cjs writes WAVs to ~/pw/bandit-math/shots/band/songs/.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { SONGS, makeBoxPart, boxNote, BOX_PATCHES, BOX_THUMP, BOX_SLAP } from '../src/audio/stagemusic.js';
import { bandChoices, choiceForKey, bandLine, soundThrough, BAND } from '../src/bandplan.js';

const lines = (song, seed, n, opts) => { const next = makeBoxPart(song, seed, opts), out = []; for (let i = 0; i < n; i++) out.push(next()); return out; };
const songOf = (id) => SONGS.find((s) => s.id === id);

test('every song has a box part, on the beat (within a hair of a half beat), inside its own line', () => {
  for (const s of SONGS) {
    const L = lines(s.id, 9, 12), per = s.bar * 4;
    L.forEach((ev, i) => {
      for (const e of ev) {
        assert.equal(e.what, 'box');
        assert.ok(['thump', 'slap', 'tap'].includes(e.hit), e.hit);
        assert.ok(e.beat >= i * per - 0.02 && e.beat < (i + 1) * per, `${s.id} line ${i}: ${e.beat}`);
        assert.ok(Math.abs(e.beat * 2 - Math.round(e.beat * 2)) < 0.03, `${s.id} off the grid: ${e.beat}`);
        assert.ok(e.vel > 0 && e.vel <= 1 && e.tone > 0.9 && e.tone < 1.1);
      }
    });
    assert.ok(L.slice(1).every((ev) => ev.length > 0), `${s.id}: the box plays every line after the first`);
  }
});

test('a thump on the first beat of every bar once the song is going', () => {
  for (const s of SONGS) {
    const L = lines(s.id, 3, 8);
    for (let i = 1; i < L.length; i++) for (let b = 0; b < 4; b++) {
      const at = i * s.bar * 4 + b * s.bar;
      assert.ok(L[i].some((e) => e.hit === 'thump' && Math.abs(e.beat - at) < 1e-9), `${s.id} line ${i} bar ${b}`);
    }
  }
});

test('the easy song keeps a backbeat: slaps on two and four', () => {
  for (const ev of lines('easy', 4, 8).slice(1)) {
    for (let b = 0; b < 4; b++) for (const k of [1, 3]) {
      const at = ev[0].beat - (ev[0].beat % 16) + b * 4 + k;
      assert.ok(ev.some((e) => e.hit === 'slap' && Math.abs(e.beat - at) < 0.02), `slap at ${at}`);
    }
  }
});

test('the waltz is in three: thump, slap, slap, and nothing on a fourth beat', () => {
  const L = lines('waltz', 6, 8);
  for (const ev of L.slice(1)) for (const e of ev) {
    const inBar = ((e.beat % 3) + 3) % 3;
    if (Math.abs(inBar) < 0.02 || Math.abs(inBar - 3) < 0.02) assert.equal(e.hit, 'thump');
    else if (Math.abs(inBar - 1) < 0.02 || Math.abs(inBar - 2) < 0.02) assert.equal(e.hit, 'slap');
    else assert.equal(e.hit, 'tap', `between beats only a light tap: ${e.beat}`);
  }
});

test('the slow song is sparse and the quick one busy', () => {
  const per = (id) => lines(id, 2, 10).slice(1).flat().length / (9 * 4);   // (hits a bar)
  assert.ok(per('lonesome') <= 2.5, `lonesome ${per('lonesome')}`);
  assert.ok(per('boots') >= 5, `boots ${per('boots')}`);
  assert.ok(per('boots') > per('easy') && per('easy') > per('lonesome'));
});

test('an opening line is left to the piano (a soft thump at most); a song asked for starts with the box at once', () => {
  for (const s of SONGS) {
    const first = lines(s.id, 5, 1)[0];
    assert.ok(first.every((e) => e.hit === 'thump' && e.vel <= 0.75), `${s.id} opening: ${JSON.stringify(first)}`);
    const asked = lines(s.id, 5, 1, { intro: false })[0];
    assert.ok(asked.some((e) => e.hit === 'slap'), `${s.id} asked for: the full part from the first line`);
  }
  assert.equal(lines('lonesome', 5, 1)[0].length, 0, 'the slow song opens on the piano alone');
});

test('the same seed gives the same box part, another seed another', () => {
  const a = JSON.stringify(lines('boots', 11, 6)), b = JSON.stringify(lines('boots', 11, 6)), c = JSON.stringify(lines('boots', 12, 6));
  assert.equal(a, b); assert.notEqual(a, c);
});

test('the old tunes are just as they were (their notes made by the same dice: the box has its own)', () => {
  // (fingerprints of the piano and harmonica notes of each song, seed 12345, twelve lines, as they were before the box)
  const want = { easy: 'e5da0f9b', 'easy-asked': 'bfe35c7c', boots: 'b049456b', 'boots-asked': '7e965627', waltz: '1acf89bc', 'waltz-asked': '361b0ddc', lonesome: 'b007b1b6', 'lonesome-asked': '98ca718b' };
  for (const s of SONGS) for (const intro of [true, false]) {
    const next = s.tune(12345, { intro }); let txt = '';
    for (let i = 0; i < 12; i++) for (const e of next()) txt += `${e.beat.toFixed(4)}|${e.what}|${e.midi}|${(e.len ?? e.lenBeats).toFixed(4)}|${(e.vel ?? e.level ?? 0).toFixed(4)};`;
    let h = 2166136261; for (const ch of txt) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    assert.equal((h >>> 0).toString(16), want[s.id + (intro ? '' : '-asked')], s.id);
  }
});

test('the box is noise through filters: no tones in its sounds', () => {
  for (const name of [BOX_THUMP, BOX_SLAP]) {
    const P = BOX_PATCHES[name];
    assert.ok(P.nodes.some((n) => n.type === 'noise'), name);
    assert.ok(!P.nodes.some((n) => n.type === 'osc'), `${name} has an oscillator`);
    for (const c of P.cables) assert.ok(P.nodes.find((n) => n.id === c.from) && P.nodes.find((n) => n.id === c.to), `${name}: ${c.from} -> ${c.to}`);
  }
  for (const hit of ['thump', 'slap', 'tap']) {
    const p = boxNote({ hit, vel: 0.7, tone: 1.02 });
    assert.ok(p.nodes.some((n) => n.type === 'out') && !p.nodes.some((n) => n.type === 'osc'), hit);
    for (const n of p.nodes) if (n.type === 'env') assert.ok((n.sustain ?? 0) === 0, `${hit}: every envelope a one-shot (the hit ends itself)`);
  }
  // (harder hits louder; a tap lighter than a slap)
  const out = (h, v) => boxNote({ hit: h, vel: v }).nodes.find((n) => n.type === 'out').gain;
  assert.ok(out('thump', 0.9) > out('thump', 0.4));
  assert.ok(out('tap', 0.6) < out('slap', 0.6));
});

test('the songs have a few words for the card', () => {
  for (const s of SONGS) assert.ok(s.feel && s.feel.length <= 16, s.id);
});

test('the card while the band plays: the songs (the one playing marked), then a break', () => {
  const rows = bandChoices({ song: songOf('waltz'), resting: false });
  assert.deepEqual(rows.map((r) => r.id), ['easy', 'boots', 'waltz', 'lonesome', 'break']);
  assert.deepEqual(rows.filter((r) => r.on).map((r) => r.id), ['waltz']);
  assert.deepEqual(rows.map((r) => r.key), ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyB']);
  assert.equal(rows[0].label, 'Easy Afternoon');
  assert.equal(rows[4].label, 'Take a break');
});

test('the card on a break: "Play again" first (the song they stopped on), then the songs, none marked playing', () => {
  const rows = bandChoices({ song: 'lonesome', resting: true });
  assert.deepEqual(rows.map((r) => r.id), ['again', 'easy', 'boots', 'waltz', 'lonesome']);
  assert.equal(rows[0].label, 'Play again'); assert.equal(rows[0].sub, 'Lonesome Trail'); assert.equal(rows[0].key, 'Enter');
  assert.ok(!rows.some((r) => r.on));
});

test('keys pick rows: the number keys (and the keypad\'s), B for the break, Enter to play again', () => {
  const playing = bandChoices({ song: 'easy' }), resting = bandChoices({ song: 'easy', resting: true });
  assert.equal(choiceForKey(playing, 'Digit2').id, 'boots');
  assert.equal(choiceForKey(playing, 'Numpad4').id, 'lonesome');
  assert.equal(choiceForKey(playing, 'KeyB').id, 'break');
  assert.equal(choiceForKey(playing, 'Enter'), null);
  assert.equal(choiceForKey(resting, 'Enter').id, 'again');
  assert.equal(choiceForKey(resting, 'NumpadEnter').id, 'again');
  assert.equal(choiceForKey(resting, 'KeyB'), null);
  assert.equal(choiceForKey(playing, 'KeyW'), null, 'walking keys go on to the game');
  assert.equal(choiceForKey(playing, null), null);
});

test('what the players say: short, one speech bubble', () => {
  for (const s of SONGS) for (const w of ['song', 'again', 'same']) { const t = bandLine(w, s); assert.ok(t.includes(s.name) && t.length <= 34, t); }
  assert.ok(bandLine('break', SONGS[0]).length <= 34);
});

test('the music through the saloon: full inside, quiet and muffled through the walls, more through a doorway in front of it', () => {
  const inside = soundThrough({ inside: true });
  assert.equal(inside.gain, 1); assert.equal(inside.hz, 20000);
  const wall = soundThrough({ ways: [{ dist: 30, facing: 1, open: 1 }] });
  assert.ok(Math.abs(wall.gain - BAND.wall.gain) < 1e-9 && Math.abs(wall.hz - BAND.wall.hz) < 1e-6, 'far from the doors: only the walls');
  const atDoor = soundThrough({ ways: [{ dist: 2, facing: 1, open: 1 }] });
  assert.ok(atDoor.gain > 3 * wall.gain && atDoor.hz > 10 * wall.hz, 'in front of a doorway');
  assert.ok(atDoor.gain < inside.gain && atDoor.hz < inside.hz, 'still less than inside');
  const beside = soundThrough({ ways: [{ dist: 2, facing: 0, open: 1 }] }), behind = soundThrough({ ways: [{ dist: 2, facing: -1, open: 1 }] });
  assert.ok(beside.gain < atDoor.gain && beside.gain > wall.gain, 'beside a doorway: some');
  assert.ok(behind.gain <= beside.gain);
  const shut = soundThrough({ ways: [{ dist: 2, facing: 1, open: 0 }] });
  assert.equal(shut.gain, wall.gain, 'a shut door: the walls only');
  // nearer a doorway: never quieter
  let last = -1;
  for (let d = 20; d >= 0; d -= 1) { const g = soundThrough({ ways: [{ dist: d, facing: 0.8, open: 1 }] }).gain; assert.ok(g >= last - 1e-12, `at ${d} m`); last = g; }
  // the nearest open doorway counts
  const two = soundThrough({ ways: [{ dist: 25, facing: 1, open: 1 }, { dist: 3, facing: 1, open: 1 }] });
  assert.ok(Math.abs(two.gain - soundThrough({ ways: [{ dist: 3, facing: 1, open: 1 }] }).gain) < 1e-9);
});
