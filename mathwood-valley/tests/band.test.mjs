// The saloon band in plain numbers: the drummer's box parts (src/audio/stagemusic.js makeBoxPart: on the beat, each
// song's own feel, a waltz in three), his sounds (noise through filters, no tones), the old tunes left exactly as they
// were, and the band's card and its sound through the saloon's walls (src/bandplan.js). How it SOUNDS is for ears: the
// render rig ~/pw/bandit-math/rigs/band/render_band.cjs writes WAVs to ~/pw/bandit-math/shots/band/songs/.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { SONGS, makeBoxPart, boxNote, BOX_PATCHES, BOX_THUMP, BOX_SLAP, readAbc, chordOf, FIDDLE_TUNES, OWN_TUNES, fiddleRound, fiddleLead, battleLead, banjoChord, banjoThumb, banjoStrum, STRUM } from '../src/audio/stagemusic.js';
import { bandChoices, choiceForKey, bandLine, soundThrough, BAND } from '../src/bandplan.js';

const lines = (song, seed, n, opts) => { const next = makeBoxPart(song, seed, opts), out = []; for (let i = 0; i < n; i++) out.push(next()); return out; };
const songOf = (id) => SONGS.find((s) => s.id === id);

test('every song has a box part, on the beat (within a hair of a half beat, or a third in a shuffle), inside its own line', () => {
  for (const s of SONGS) {
    const L = lines(s.id, 9, 12), per = s.bar * 4;
    L.forEach((ev, i) => {
      for (const e of ev) {
        assert.equal(e.what, 'box');
        assert.ok(['thump', 'slap', 'tap'].includes(e.hit), e.hit);
        assert.ok(e.beat >= i * per - 0.02 && e.beat < (i + 1) * per, `${s.id} line ${i}: ${e.beat}`);
        const grid = s.swing ? 3 : s.box === 'gallop' ? 4 : 2;   // (a shuffle's late "and" is two thirds through the beat; a gallop's taps a quarter)
        assert.ok(Math.abs(e.beat * grid - Math.round(e.beat * grid)) < 0.02 * Math.max(2, grid), `${s.id} off the grid: ${e.beat}`);
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
      const time = Math.floor(k / round.length), lead = T.leads && fiddle ? T.leads[(bar.pos + time) % T.leads.length] : fiddleLead(bar.pos, time, fiddle), at = (1 + Math.floor(k / 4)) * 16 + (k % 4) * 4;
      if (!(T.leads && fiddle)) assert.equal(lead, fiddle ? ['fiddle', 'harp', 'piano', 'fiddle+harp'][(bar.pos + time) % 4] : ['harp', 'piano'][(bar.pos + time) % 2], `${id} bar ${k}`);
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

test('Stagecoach Boogie: two 12-bar blues, swung, the fiddle and harmonica trading, the piano light, rolling, stop-time, flares', () => {
  const T = OWN_TUNES.boogie, round = fiddleRound(T), s = SONGS.find((x) => x.id === 'boogie');
  assert.equal(round.length, 48); assert.ok(round.every((b) => b.len === 4 && b.n === 12));
  const blues = ['A', 'A', 'A', 'A', 'D', 'D', 'A', 'A', 'E', 'D', 'A', 'E'];
  assert.deepEqual(round.slice(0, 12).map((b) => b.chords[0].name), blues); assert.deepEqual(round.slice(24, 36).map((b) => b.chords[0].name), blues);
  assert.ok(round.flatMap((b) => b.notes).filter((n) => n.bend).length >= 12, 'bent notes');
  assert.equal(s.group, 'own'); assert.equal(s.home, 'A'); assert.equal(s.round, 12);
  const L = []; { const next = s.tune(3, { intro: true, fiddle: true }); for (let i = 0; i < 14; i++) L.push(next()); }
  const bassIn = (line, bar) => L[line].filter((e) => e.what === 'piano' && !e.lead && !Array.isArray(e.midi) && e.beat >= line * 16 + bar * 4 && e.beat < line * 16 + bar * 4 + 4 && e.midi < 60);
  // the first A: a bassist's two beats, softer; the second A: the roll, A C# E F# G F# E C#, swung (two thirds, a third)
  assert.deepEqual(bassIn(1, 0).map((e) => e.midi), [45, 40]);
  const roll = bassIn(4, 0);
  assert.deepEqual(roll.map((e) => e.midi), [45, 49, 52, 54, 55, 54, 52, 49]);
  assert.deepEqual(roll.map((e) => +(e.beat - 64).toFixed(3)), [0, 0.667, 1, 1.667, 2, 2.667, 3, 3.667]);
  assert.ok(roll.every((e) => e.gain < 1), 'the roll softer than a full touch');
  // the first B: stop-time over its first four bars (a hit on one, a hush), then the roll
  const B1 = 1 + 6;   // (line 7: the B's first four bars)
  const hush = L[B1].filter((e) => e.what === 'hush');
  assert.equal(hush.length, 4); assert.ok(hush.every((h) => h.to - h.from > 3.5));
  assert.equal(bassIn(B1, 0).length, 0, 'no roll under stop-time (the hit is an octave pair)');
  // the battle: in the A, the fiddle calls (bar 1), the harmonica answers (bar 2), both in the turnaround
  const who = (line, bar) => [...new Set(L[line].filter((e) => (e.what === 'harp' || e.what === 'fiddle' || (e.what === 'piano' && e.lead)) && e.beat >= line * 16 + bar * 4 && e.beat < line * 16 + bar * 4 + 4).map((e) => e.what))].sort().join('+');
  assert.equal(who(1, 0), 'fiddle'); assert.equal(who(1, 1), 'harp'); assert.equal(who(3, 0), 'fiddle+harp');
  assert.equal(battleLead(T, round[0], 1, true), 'harp', 'the next time round the harmonica calls');
  assert.equal(battleLead(T, round[0], 0, false), 'harp'); assert.equal(battleLead(T, round[1], 0, false), 'piano', 'no fiddle: the piano answers');
  assert.ok(L[1].filter((e) => e.what === 'fiddle').every((e) => e.midi >= 69), 'the fiddle an octave up');
  // the flares: a run up the keys in the last bar of each section
  const flare = L[3].filter((e) => e.what === 'piano' && !e.lead && !Array.isArray(e.midi) && e.midi >= 60 && e.beat >= 3 * 16 + 12 + 2);
  assert.ok(flare.length >= 6 && flare.every((e, i, a) => i === 0 || e.midi > a[i - 1].midi), JSON.stringify(flare.map((e) => e.midi)));
  const harp = L[1].filter((e) => e.what === 'harp');
  assert.ok(harp.some((e) => e.bend === 100) || L[2].some((e) => e.what === 'harp' && e.bend === 100), 'a bent note in the head');
  const box = makeBoxPart('boogie', 3)(); assert.ok(box.length === 0 || box.every((e) => e.hit === 'thump'));
  const drive = makeBoxPart('boogie', 3); drive(); const bar = drive().filter((e) => e.beat < 20);
  for (const b of [0, 2]) assert.ok(bar.some((e) => e.hit === 'thump' && Math.abs(e.beat - 16 - b) < 0.02));
  for (const b of [1, 3]) assert.ok(bar.some((e) => e.hit === 'slap' && Math.abs(e.beat - 16 - b) < 0.02));
});

test('the banjo: turns in the banjo tunes only when it\'s in the band (with the fiddle: banjo, harmonica, fiddle, piano, banjo and fiddle)', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((p) => fiddleLead(p, 0, true, true)), ['banjo', 'harp', 'fiddle', 'piano', 'banjo+fiddle']);
  assert.deepEqual([0, 1, 2, 3].map((p) => fiddleLead(p, 0, false, true)), ['banjo', 'harp', 'piano', 'banjo+harp']);
  for (const id of ['cripple', 'joeclark', 'susanna', 'camptown', 'sailor', 'wellerman', 'blowman', 'haulaway']) {
    const s = SONGS.find((x) => x.id === id), T = FIDDLE_TUNES[id], round = fiddleRound(T);
    assert.equal(T.banjo, true, id);
    const L = []; { const next = s.tune(5, { intro: true, fiddle: true, banjo: true }); for (let i = 0; i <= round.length / 4; i++) L.push(next()); }
    const bj = L.flat().filter((e) => e.what === 'banjo');
    assert.ok(bj.length > 10, `${id}: the banjo plays`);
    assert.ok(bj.filter((e) => !e.strum).every((e) => e.midi >= 48 && e.midi <= 84 && e.lenBeats > 0), `${id}: in its range`);
    assert.ok(bj.some((e) => e.strum), `${id}: the strum between turns`);
    const none = s.tune(5, { intro: true, fiddle: true, banjo: false }); for (let i = 0; i < 4; i++) assert.ok(!none().some((e) => e.what === 'banjo'), `${id}: no banjo without its kit`);
  }
  const sj = SONGS.find((x) => x.id === 'soldiers').tune(5, { intro: false, fiddle: true, banjo: true });
  for (let i = 0; i < 8; i++) assert.ok(!sj().some((e) => e.what === 'banjo'), 'not a banjo tune: none');
});

test('Oh! Susanna and Camptown Races: they read, sixteen four-beat bars a round, every chord a real one', () => {
  for (const [id, bars] of [['susanna', 16], ['camptown', 16]]) {
    const T = FIDDLE_TUNES[id], round = fiddleRound(T), s = SONGS.find((x) => x.id === id);
    assert.ok(s && s.round === bars / 4 && T.banjo, id);
    assert.equal(round.length, bars, id);
    for (const b of round) {
      assert.ok(Math.abs(b.len - 4) < 1e-9, `${id} bar ${b.part}${b.i}: ${b.len} beats`);
      for (const c of b.chords) { assert.ok(/^[A-G][#b]?m?7?$/.test(c.name), `${id}: chord ${c.name}`); assert.equal(banjoChord(c.name, T.semi).strum.length, 3); }
      for (const n of b.notes) if (n.midi != null) assert.ok(n.midi + T.semi >= 57 && n.midi + T.semi <= 76, `${id}: ${n.midi} in the harmonica's range`);
    }
  }
  assert.equal(readAbc(FIDDLE_TUNES.susanna.parts.A, { key: 'G' })[0].notes.map((n) => n.midi).join(' '), '71 74 74 76 74 71 67 69');   // I come from Al-a-bam-a
  assert.equal(readAbc(FIDDLE_TUNES.camptown.parts.A, { key: 'D' })[0].notes.map((n) => n.midi).join(' '), '69 69 66 69 71 69 66');   // Camptown ladies sing this song
});

test('William Tell and the Mountain King: they read, four-beat bars, real chords, the fiddle the star, the box gallops', () => {
  for (const id of ['tell', 'mountain']) {
    const T = FIDDLE_TUNES[id], round = fiddleRound(T), s = SONGS.find((x) => x.id === id);
    assert.equal(round.length, 16, id); assert.equal(s.round, 4);
    for (const b of round) {
      assert.ok(Math.abs(b.len - 4) < 1e-9, `${id} bar ${b.part}${b.i}: ${b.len} beats`);
      for (const c of b.chords) assert.ok(/^[A-G][#b]?m?7?$/.test(c.name), `${id}: chord ${c.name}`);
      for (const n of b.notes) if (n.midi != null) assert.ok(n.midi + T.semi >= 57 && n.midi + T.semi <= 76, `${id}: ${n.midi} in the harmonica's range`);
    }
  }
  assert.equal(readAbc(FIDDLE_TUNES.mountain.parts.A, { key: 'Bm' })[0].notes.map((n) => n.midi).join(' '), '59 61 62 64 66 62 66');
  assert.equal(readAbc(FIDDLE_TUNES.mountain.parts.A, { key: 'Bm' })[1].notes.map((n) => n.midi).join(' '), '65 61 65 64 60 64');
  assert.equal(readAbc(FIDDLE_TUNES.tell.parts.A, { key: 'G' })[0].notes.map((n) => n.len).join(' '), '0.25 0.25 0.5 0.25 0.25 0.5 0.25 0.25 0.5 0.5 0.5');
  const tell = SONGS.find((x) => x.id === 'tell'), L = []; { const next = tell.tune(5, { intro: false, fiddle: true }); for (let i = 0; i < 8; i++) L.push(next()); }
  const ev = L.flat(), fid = ev.filter((e) => e.what === 'fiddle').length, harp = ev.filter((e) => e.what === 'harp').length;
  assert.ok(fid > harp, `the fiddle the star: ${fid} notes to the harmonica's ${harp}`);
  assert.equal(tell.box, 'gallop');
  const box = makeBoxPart('tell', 3, { intro: false })(), taps = box.filter((e) => e.hit === 'tap').length;
  assert.ok(taps >= 24, `the gallop's quick taps: ${taps}`);
});

test('the sea shanties: they read, sixteen four-beat bars, minor chords that strum, the box stomps on the beat', () => {
  for (const id of ['sailor', 'wellerman']) {
    const T = FIDDLE_TUNES[id], round = fiddleRound(T), s = SONGS.find((x) => x.id === id);
    assert.equal(round.length, 16, id); assert.ok(T.banjo && s.box === 'stomp', id);
    for (const b of round) {
      assert.ok(Math.abs(b.len - 4) < 1e-9, `${id} bar ${b.part}${b.i}: ${b.len} beats`);
      for (const c of b.chords) { assert.ok(/^[A-G][#b]?m?7?$/.test(c.name), `${id}: chord ${c.name}`); assert.equal(banjoChord(c.name, T.semi).strum.length, 3); }
      for (const n of b.notes) if (n.midi != null) assert.ok(n.midi + T.semi >= 57 && n.midi + T.semi <= 76, `${id}: ${n.midi}`);
    }
    assert.equal(round[0].chords[0].name, 'Dm');
  }
  assert.deepEqual(banjoChord('Dm'), { root: 50, fifth: 45, strum: [57, 62, 65] });
  assert.equal(banjoThumb('Dm'), 69);
  assert.equal(readAbc(FIDDLE_TUNES.sailor.parts.A, { key: 'Ddor' })[5].notes.map((n) => n.midi).join(' '), '69 71 72 74', 'Dorian: B natural');
  assert.equal(readAbc(FIDDLE_TUNES.wellerman.parts.A, { key: 'Dm' })[2].notes[0].midi, 70, 'D minor: B flat');
  const box = makeBoxPart('wellerman', 3, { intro: false })();
  for (let b = 0; b < 4; b++) assert.ok(box.some((e) => Math.abs(e.beat - b * 4) < 0.02 && e.hit === 'thump' && e.vel > 0.85), 'a big downbeat every bar');
  assert.ok(!box.some((e) => e.hit === 'tap'), 'no taps: the stomp');
});

test('three more: Blow the Man Down rolls (thirds of a beat), Haul Away Joe stomps, Shenandoah is slow with the banjo only strumming', () => {
  for (const id of ['blowman', 'haulaway', 'shenandoah']) {
    const T = FIDDLE_TUNES[id], round = fiddleRound(T);
    assert.equal(round.length, 16, id);
    for (const b of round) {
      assert.ok(Math.abs(b.len - 4) < 1e-9, `${id} bar ${b.part}${b.i}: ${b.len} beats`);
      for (const c of b.chords) { assert.ok(/^[A-G][#b]?m?7?$/.test(c.name), `${id}: chord ${c.name}`); assert.equal(banjoChord(c.name, T.semi).strum.length, 3); }
      for (const n of b.notes) if (n.midi != null) assert.ok(n.midi + T.semi >= 57 && n.midi + T.semi <= 76, `${id}: ${n.midi}`);
    }
  }
  const bm = FIDDLE_TUNES.blowman;
  assert.ok(fiddleRound(bm).every((b) => b.notes.every((n) => Math.abs(n.at * 3 - Math.round(n.at * 3)) < 1e-9)), 'Blow the Man Down: on the thirds');
  assert.deepEqual(banjoStrum(0, 'G', 'G', bm, bm.beat).filter((e) => e.strum === 'ty').map((e) => +e.beat.toFixed(4)), [1.6667, 3.6667], 'its ty rolls too');
  assert.equal(SONGS.find((x) => x.id === 'haulaway').box, 'stomp');
  const sh = SONGS.find((x) => x.id === 'shenandoah'), T = FIDDLE_TUNES.shenandoah, L = [];
  assert.ok(sh.beat > 0.8, 'slow');
  { const next = sh.tune(5, { intro: false, fiddle: true, banjo: true }); for (let i = 0; i < 8; i++) L.push(next()); }
  const ev = L.flat(), bj = ev.filter((e) => e.what === 'banjo');
  assert.ok(bj.length > 0 && bj.every((e) => e.strum), 'the banjo only strums');
  assert.ok(bj.every((e) => e.vel <= STRUM.bum * T.strum + 1e-9), 'softly');
  assert.ok(ev.some((e) => e.what === 'fiddle' && !e.doubled) && ev.some((e) => e.what === 'harp'), 'the fiddle and the harmonica trade it');
  assert.ok(!ev.some((e) => e.what === 'piano' && e.lead), 'no piano turns while the fiddle is in');
});

test('the banjo strum: bum-ditty on the bar\'s chord, the bass root then fifth, the strum high to low, the thumb string', () => {
  assert.deepEqual(banjoChord('G'), { root: 43, fifth: 50, strum: [55, 59, 62] });
  assert.deepEqual(banjoChord('C'), { root: 48, fifth: 43, strum: [55, 60, 64] });
  assert.deepEqual(banjoChord('D'), { root: 50, fifth: 45, strum: [54, 57, 62] });
  assert.deepEqual(banjoChord('Em').strum, [55, 59, 64]);
  assert.equal(banjoThumb('G'), 67); assert.equal(banjoThumb('D'), 69); assert.equal(banjoThumb('Amix', -5), 64);
  const T = FIDDLE_TUNES.susanna, B = T.beat, ev = banjoStrum(8, 'G', 'G', T, B);
  const bums = ev.filter((e) => e.strum === 'bum'), dits = ev.filter((e) => e.strum === 'dit'), tys = ev.filter((e) => e.strum === 'ty');
  assert.deepEqual(bums.map((e) => [e.beat, e.midi]), [[8, 43], [10, 50]]);
  assert.deepEqual(tys.map((e) => [e.beat, e.midi]), [[9.5, 67], [11.5, 67]]);
  assert.deepEqual(dits.slice(0, 3).map((e) => e.midi), [62, 59, 55], 'high to low');
  dits.slice(0, 3).forEach((e, j) => assert.ok(Math.abs((e.beat - 9) * B - j * STRUM.gap) < 1e-9, '12 ms apart'));
  assert.ok(dits.every((e) => e.vel < bums[0].vel && e.lenBeats < bums[0].lenBeats), 'the dit shorter and softer');
  // (a change on three: the new chord's root, not the fifth)
  assert.deepEqual(banjoStrum(0, 'G', 'D', T, B).filter((e) => e.strum === 'bum').map((e) => e.midi), [43, 50]);
  assert.deepEqual(banjoStrum(0, 'C', 'C', T, B).filter((e) => e.strum === 'bum').map((e) => e.midi), [48, 43]);
  // in the song: only while someone else has the tune
  const s = SONGS.find((x) => x.id === 'susanna'), next = s.tune(5, { intro: false, banjo: true });
  for (let i = 0; i < 8; i++) {
    const L = next();
    for (let b = 0; b < 4; b++) {
      const inBar = L.filter((e) => e.what === 'banjo' && e.beat >= i * 16 + b * 4 && e.beat < i * 16 + b * 4 + 4);
      assert.ok(!(inBar.some((e) => e.strum) && inBar.some((e) => !e.strum)), 'never strum over its own turn');
    }
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
  assert.deepEqual(rows.map((r) => r.id), ['easy', 'boots', 'waltz', 'boogie', 'lonesome', 'soldiers', 'joeclark', 'arkansas', 'sally', 'cripple', 'devils', 'fishers', 'susanna', 'camptown', 'tell', 'mountain', 'sailor', 'wellerman', 'blowman', 'haulaway', 'shenandoah', 'break']);
  assert.deepEqual(rows.filter((r) => r.on).map((r) => r.id), ['waltz']);
  assert.deepEqual(rows.slice(0, 12).map((r) => r.key), ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal']);
  assert.deepEqual(rows.slice(0, 12).map((r) => r.keyName), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=']);
  assert.deepEqual(rows.slice(0, 12).map((r) => r.group), ['own', 'own', 'own', 'own', 'own', 'old', 'old', 'old', 'old', 'old', 'old', 'old']);
  assert.equal(rows[rows.length - 1].key, 'KeyB');
  assert.equal(rows[0].label, 'Easy Afternoon');
  assert.equal(rows[3].label, 'Stagecoach Boogie');
  assert.equal(rows[5].label, "Soldier's Joy");
  assert.equal(rows[rows.length - 1].label, 'Take a break');
});

test('the card on a break: "Play again" first (the song they stopped on), then the songs, none marked playing', () => {
  const rows = bandChoices({ song: 'lonesome', resting: true });
  assert.deepEqual(rows.map((r) => r.id), ['again', 'easy', 'boots', 'waltz', 'boogie', 'lonesome', 'soldiers', 'joeclark', 'arkansas', 'sally', 'cripple', 'devils', 'fishers', 'susanna', 'camptown', 'tell', 'mountain', 'sailor', 'wellerman', 'blowman', 'haulaway', 'shenandoah']);
  assert.equal(rows[0].label, 'Play again'); assert.equal(rows[0].sub, 'Lonesome Trail'); assert.equal(rows[0].key, 'Enter');
  assert.ok(!rows.some((r) => r.on));
});

test('keys pick rows: the number keys (and the keypad\'s), B for the break, Enter to play again', () => {
  const playing = bandChoices({ song: 'easy' }), resting = bandChoices({ song: 'easy', resting: true });
  assert.equal(choiceForKey(playing, 'Digit2').id, 'boots');
  assert.equal(choiceForKey(playing, 'Numpad4').id, 'boogie');
  assert.equal(choiceForKey(playing, 'Digit5').id, 'lonesome');
  assert.equal(choiceForKey(playing, 'KeyB').id, 'break');
  assert.equal(choiceForKey(playing, 'Digit0').id, 'cripple');
  assert.equal(choiceForKey(playing, 'Minus').id, 'devils');
  assert.equal(choiceForKey(playing, 'NumpadSubtract').id, 'devils');
  assert.equal(choiceForKey(playing, 'Equal').id, 'fishers');
  assert.ok(!choiceForKey(playing, 'BracketLeft'), 'no keys past twelve songs: the card is clicked');
  assert.ok(playing.filter((r) => r.id !== 'break').slice(12).every((r) => !r.key));
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
