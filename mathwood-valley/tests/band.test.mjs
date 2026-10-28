// The saloon band in plain numbers: the drummer's box parts (src/audio/stagemusic.js makeBoxPart: on the beat, each
// song's own feel, a waltz in three), his sounds (noise through filters, no tones), the old tunes left exactly as they
// were, and the band's card and its sound through the saloon's walls (src/bandplan.js). How it SOUNDS is for ears: the
// render rig ~/pw/bandit-math/rigs/band/render_band.cjs writes WAVs to ~/pw/bandit-math/shots/band/songs/.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { SONGS, makeBoxPart, boxNote, BOX_PATCHES, BOX_THUMP, BOX_SLAP, readAbc, chordOf, FIDDLE_TUNES, fiddleRound, fiddleLead } from '../src/audio/stagemusic.js';
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
  for (const s of SONGS.filter((x) => want[x.id])) for (const intro of [true, false]) {
    const next = (s.make || s.tune)(12345, { intro }); let txt = '';   // (the dice's notes, before the turns)
    for (let i = 0; i < 12; i++) for (const e of next()) txt += `${e.beat.toFixed(4)}|${e.what}|${e.midi}|${(e.len ?? e.lenBeats).toFixed(4)}|${(e.vel ?? e.level ?? 0).toFixed(4)};`;
    let h = 2166136261; for (const ch of txt) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    assert.equal((h >>> 0).toString(16), want[s.id + (intro ? '' : '-asked')], s.id);
  }
});

test('ABC read as written: letters to notes, the key\'s sharps, lengths, rests, accidentals to the bar\'s end, chords', () => {
  const [a, b] = readAbc('"D"D2 F A/2B/2 c3/2 z/2|^G G =G g\' C, z', { key: 'D' });
  assert.deepEqual(a.notes.map((n) => [n.at, n.len, n.midi]), [[0, 1, 62], [1, 0.5, 66], [1.5, 0.25, 69], [1.75, 0.25, 71], [2, 0.75, 73], [2.75, 0.25, null]]);
  assert.deepEqual(a.chords, [{ at: 0, name: 'D' }]);
  assert.deepEqual(b.notes.map((n) => n.midi), [68, 68, 67, 91, 49, null]);
  assert.equal(readAbc('fga', { key: 'Amix' })[0].notes.map((n) => n.midi).join(), '78,79,81', 'A mixolydian: F and C sharp, G natural');
});

test('chords for the piano as the band\'s own: G, C and D land where CHORDS has them', () => {
  assert.deepEqual(chordOf('G'), { root: 43, fifth: 38, voicing: [[55, 59, 62], [59, 62, 67]] });
  for (const [n, root, fifth] of [['C', 48, 43], ['D', 38, 45], ['A', 45, 40], ['Em', 40, 47]]) { const c = chordOf(n); assert.deepEqual([c.root, c.fifth], [root, fifth], n); }
  assert.deepEqual(chordOf('D', -5), chordOf('A'), 'down a fourth');
  assert.deepEqual(chordOf('Em').voicing[0], [55, 59, 64], 'minor');
});

test('the fiddle tunes: whole bars of four beats, the sections in their order, the notes as the tunebooks write them', () => {
  const N = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], nm = (m) => (m == null ? '-' : N[m % 12]);
  for (const [id, T] of Object.entries(FIDDLE_TUNES)) {
    const r = fiddleRound(T);
    assert.equal(r.length, T.form.reduce((n, p) => n + readAbc(T.parts[p], { key: T.key, unit: T.unit ?? 0.5 }).length, 0), id);
    assert.equal(r.length % 4, 0, `${id}: whole lines of four bars`);
    for (const bar of r) { assert.equal(bar.len, 4, `${id} ${bar.part}${bar.i + 1}`); assert.ok(bar.chords[0].at === 0 && bar.chords[0].name, `${id}: a chord from the bar's start`); }
    const all = r.flatMap((b) => b.notes).filter((n) => n.midi != null).map((n) => n.midi + T.semi);
    assert.ok(Math.min(...all) >= 55 && Math.max(...all) <= 76, `${id}: in the harmonica's range as played (G3..E5): ${Math.min(...all)}..${Math.max(...all)}`);
  }
  const sj = fiddleRound(FIDDLE_TUNES.soldiers).map((b) => b.notes.map((n) => nm(n.midi)).join(' '));
  assert.equal(sj[0], 'A F# D F# A F# D F#'); assert.equal(sj[6], 'F# A F# D E G E C#'); assert.equal(sj[16], 'F# D F# D F# A G F#');
  const oj = fiddleRound(FIDDLE_TUNES.joeclark).map((b) => b.notes.map((n) => nm(n.midi)).join(' '));
  assert.equal(oj[0], 'E F# G F#', 'G natural: A mixolydian'); assert.equal(oj[16], 'A A B C# B A'); assert.equal(oj[19], 'G -');
  const tune = (id) => fiddleRound(FIDDLE_TUNES[id]).map((b) => b.notes.map((n) => nm(n.midi)).join(' '));
  const at = tune('arkansas');
  assert.equal(at[0], 'D F# E D B B'); assert.equal(at[7], 'F# E D A', 'the first ending back to A'); assert.equal(at[15], 'F# E D F# G', 'the second: into B');
  assert.equal(tune('sally')[8], 'E E E C# E', 'Sally Goodin, high part');
  assert.equal(tune('cripple')[0], 'A A E G# F# E');
  assert.equal(tune('devils')[2], 'D F# B F# D F# B F#');
  const fh = fiddleRound(FIDDLE_TUNES.fishers);
  assert.equal(fh[0].notes.map((n) => nm(n.midi)).join(' '), 'F C A C A# D C A#', 'F major: B flat');
  assert.deepEqual(fh[3].notes.slice(-3).map((n) => +n.len.toFixed(4)), [0.3333, 0.3333, 0.3333], 'the triplet: three in the time of two (a third of a beat each)');
});

test('the band plays a fiddle tune: the piano alone in the opening line, then the tune round and round, the fiddle, the harmonica and the piano taking turns', () => {
  for (const id of Object.keys(FIDDLE_TUNES)) for (const fiddle of [false, true]) {
    const s = SONGS.find((x) => x.id === id), T = FIDDLE_TUNES[id], round = fiddleRound(T);
    assert.equal(s.round, round.length / 4, `${id}: its lines once round`);
    assert.equal(s.beat, T.beat); assert.equal(s.bar, 4);
    const lines = round.length / 4, next = s.tune(7, { intro: true, fiddle }), L = []; for (let i = 0; i < 2 * lines + 2; i++) L.push(next());
    assert.equal(L[0].filter((e) => e.what === 'harp').length, 0, `${id}: the opening line is the piano's`);
    assert.ok(L[0].filter((e) => e.what === 'piano').length >= 16, id);
    // (the tune's notes, in order, line after line, twice round: the sections take turns down the order, the harmonica
    // and the piano's right hand an octave up; with the fiddle: the fiddle, the harmonica, the piano, the fiddle and
    // harmonica together; moving on one each time round)
    const bars = [...round, ...round], played = L.slice(1, 1 + 2 * lines);
    bars.forEach((bar, k) => {
      const time = Math.floor(k / round.length), lead = fiddleLead(bar.pos, time, fiddle), at = (1 + Math.floor(k / 4)) * 16 + (k % 4) * 4;
      assert.equal(lead, fiddle ? ['fiddle', 'harp', 'piano', 'fiddle+harp'][(bar.pos + time) % 4] : ['harp', 'piano'][(bar.pos + time) % 2], `${id} bar ${k}`);
      const inBar = (what) => played.flat().filter((e) => e.what === what && (what !== 'piano' || e.lead) && e.beat >= at - 1e-9 && e.beat < at + 4 - 1e-9).map((e) => [+(e.beat - at).toFixed(4), e.midi]);
      const tune = bar.notes.filter((n) => n.midi != null), as = (up) => tune.map((n) => [+n.at.toFixed(4), n.midi + T.semi + up]);
      assert.deepEqual(inBar('harp'), lead.includes('harp') ? as(0) : [], `${id} bar ${k}: the harmonica`);
      assert.deepEqual(inBar('fiddle'), lead.includes('fiddle') ? as(0) : [], `${id} bar ${k}: the fiddle`);
      assert.deepEqual(inBar('piano'), lead === 'piano' ? as(12) : [], `${id} bar ${k}: the piano's right hand`);
      const chick = played.flat().filter((e) => e.what === 'piano' && Array.isArray(e.midi) && e.beat >= at && e.beat < at + 4).length;
      assert.equal(chick, lead === 'piano' ? 0 : 2, `${id} bar ${k}: the soft chords only while the right hand is free`);
      for (const e of played.flat()) if (e.what === 'fiddle') assert.equal(e.doubled, played.flat().some((h) => h.what === 'harp' && h.beat === e.beat && h.midi === e.midi), `${id}: doubled marks the harmonica playing it too`);
    });
    const asked = s.tune(7, { intro: false, fiddle })();
    assert.deepEqual(asked.filter((e) => e.what === (fiddle ? 'fiddle' : 'harp')).map((e) => e.midi), round.slice(0, 4).flatMap((b) => b.notes).filter((n) => n.midi != null).map((n) => n.midi + T.semi), `${id}: asked for, the tune at once (${fiddle ? 'the fiddle' : 'the harmonica'} first)`);
    for (const e of L.flat()) if (e.what === 'harp') assert.ok(e.lenBeats >= 0.3 && e.lenBeats < 4, `${id}: ${e.lenBeats}`);
  }
});

test('the band\'s own songs take turns: every other line the harmonica plays goes to the piano\'s right hand, an octave up', () => {
  for (const s of SONGS.filter((x) => x.make)) {
    const raw = s.make(4321, { intro: true }), turned = s.tune(4321, { intro: true });
    let played = 0, given = 0;
    for (let i = 0; i < 16; i++) {
      const a = raw(), b = turned(), harp = a.filter((e) => e.what === 'harp');
      if (!harp.length) { assert.deepEqual(b, a, `${s.id} line ${i}: no harmonica, no change`); continue; }
      const mine = played++ % 2 === 1, lead = b.filter((e) => e.what === 'piano' && e.lead);
      if (!mine) { assert.deepEqual(b, a, `${s.id} line ${i}: the harmonica's`); continue; }
      given++;
      assert.equal(b.filter((e) => e.what === 'harp').length, 0, `${s.id} line ${i}: the harmonica rests`);
      assert.deepEqual(lead.map((e) => [e.beat, e.midi]), harp.map((e) => [e.beat, e.midi + 12]), `${s.id} line ${i}: his notes, an octave up`);
      assert.ok(!b.some((e) => e.what === 'piano' && Array.isArray(e.midi) && Math.min(...e.midi) >= 50), `${s.id} line ${i}: no soft chords under the right hand`);
      assert.ok(lead.every((e) => e.len > 0 && e.vel > 0 && e.vel <= 0.5), s.id);
    }
    assert.ok(given >= 2, `${s.id}: the piano had turns (${given})`);
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
  assert.deepEqual(rows.map((r) => r.id), ['easy', 'boots', 'waltz', 'lonesome', 'soldiers', 'joeclark', 'arkansas', 'sally', 'cripple', 'devils', 'fishers', 'break']);
  assert.deepEqual(rows.filter((r) => r.on).map((r) => r.id), ['waltz']);
  assert.deepEqual(rows.slice(0, 11).map((r) => r.key), ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus']);
  assert.deepEqual(rows.slice(0, 11).map((r) => r.keyName), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-']);
  assert.deepEqual(rows.slice(0, 11).map((r) => r.group), ['own', 'own', 'own', 'own', 'old', 'old', 'old', 'old', 'old', 'old', 'old']);
  assert.equal(rows[rows.length - 1].key, 'KeyB');
  assert.equal(rows[0].label, 'Easy Afternoon');
  assert.equal(rows[4].label, "Soldier's Joy");
  assert.equal(rows[rows.length - 1].label, 'Take a break');
});

test('the card on a break: "Play again" first (the song they stopped on), then the songs, none marked playing', () => {
  const rows = bandChoices({ song: 'lonesome', resting: true });
  assert.deepEqual(rows.map((r) => r.id), ['again', 'easy', 'boots', 'waltz', 'lonesome', 'soldiers', 'joeclark', 'arkansas', 'sally', 'cripple', 'devils', 'fishers']);
  assert.equal(rows[0].label, 'Play again'); assert.equal(rows[0].sub, 'Lonesome Trail'); assert.equal(rows[0].key, 'Enter');
  assert.ok(!rows.some((r) => r.on));
});

test('keys pick rows: the number keys (and the keypad\'s), B for the break, Enter to play again', () => {
  const playing = bandChoices({ song: 'easy' }), resting = bandChoices({ song: 'easy', resting: true });
  assert.equal(choiceForKey(playing, 'Digit2').id, 'boots');
  assert.equal(choiceForKey(playing, 'Numpad4').id, 'lonesome');
  assert.equal(choiceForKey(playing, 'KeyB').id, 'break');
  assert.equal(choiceForKey(playing, 'Digit0').id, 'devils');
  assert.equal(choiceForKey(playing, 'Minus').id, 'fishers');
  assert.equal(choiceForKey(playing, 'NumpadSubtract').id, 'fishers');
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
  const wall = soundThrough({ ways: [{ dist: 60, facing: 1, open: 1 }] });
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
