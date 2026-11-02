// Where a note is played: the string and stop from its pitch, the hand's position, and the bass line from the piano's left hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planNote, FRETTED, fretDistance } from '../src/fretplan.js';
import { bassNote, stopX, BASS, stringAt, PLUCK } from '../src/bassplan.js';
import { SONGS } from '../src/audio/stagemusic.js';

test('every plan sounds the note asked for, on its own string and stop', () => {
  for (const kind of Object.keys(FRETTED)) {
    const I = FRETTED[kind]; let pos = I.home;
    for (let m = I.open[0]; m <= I.open[3] + I.top; m++) {
      const p = planNote(m, pos, kind); pos = p.pos;
      assert.equal(I.open[p.string] + p.fret, m, `${kind} ${m}`);
      assert.equal(p.octave, 0);
      if (p.open) assert.equal(p.finger, null); else assert.ok(p.fret >= p.pos && p.fret <= p.pos + I.span, `${kind} ${m} in the hand's reach`);
    }
  }
});
test('the bass: E A D G, open strings low, a note below the E up an octave, no shift when the hand already has it', () => {
  assert.deepEqual(planNote(28, 1, 'bass').string, 0); assert.ok(planNote(28, 1, 'bass').open);
  assert.equal(planNote(43, 1, 'bass').open, true);    // (open G)
  assert.equal(planNote(30, 1, 'bass').fret, 2);       // F#: E string, stop 2, hand in first position
  assert.equal(planNote(30, 1, 'bass').pos, 1);
  assert.equal(planNote(30, 1, 'bass').finger, 'Middle');
  assert.equal(planNote(26, 1, 'bass').octave, 12);
  const up = planNote(47, 4, 'bass'); assert.equal(up.pos, 4); assert.equal(up.string, 3);   // (B on the G string, the hand already there)
});
test('a song\'s position stays on the board: the bass player follows the piano\'s left hand', () => {
  for (const s of SONGS) {
    const tune = s.tune(3, { intro: true, fiddle: true, banjo: true }); let pos = 1, shifts = 0, n = 0, top = 0;
    for (let i = 0; i < 16; i++) for (const e of tune()) { const m = bassNote(e); if (m == null) continue; const p = planNote(m, pos, 'bass'); if (p.pos !== pos) shifts++; pos = p.pos; n++; top = Math.max(top, p.fret); }
    assert.ok(n > 0, `${s.id} has low notes`);
    assert.ok(top <= 12, `${s.id} stays on the board: ${top}`);
    assert.ok(shifts / n < 0.8, `${s.id}: ${shifts} shifts of ${n}`);
  }
});
test('the notes he follows: the piano\'s left hand at its own pitch, a chord\'s lowest, nothing else', () => {
  assert.equal(bassNote({ what: 'piano', midi: 43 }), 43);
  assert.equal(bassNote({ what: 'piano', midi: [50, 57] }), 50);
  assert.equal(bassNote({ what: 'piano', midi: 55 }), null);
  assert.equal(bassNote({ what: 'piano', midi: [60, 64] }), null);
  assert.equal(bassNote({ what: 'harp', midi: 40 }), null);
});
test('a full-size bass: its stops on the board, the strings over it', () => {
  assert.ok(Math.abs(BASS.nut - BASS.bridge.x - BASS.scale) < 1e-9);
  assert.ok(Math.abs(fretDistance(12, BASS.scale) - BASS.scale / 2) < 1e-9);
  assert.ok(stopX(12) > BASS.fingerboard.from && PLUCK < stopX(12) && PLUCK > BASS.fingerboard.from);
  assert.ok(BASS.body + BASS.endpin + (BASS.nut - BASS.body) + BASS.scroll > 1.85);
  assert.ok(stringAt(0, BASS.nut)[2] < stringAt(3, BASS.nut)[2]);
});
