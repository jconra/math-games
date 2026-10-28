// Checks the clips made in Blender for this game (models/people/clips_m.glb and clips_f.glb: lassoing and riding) agree
// with the people they are played on: the exact names, the lengths, only the skeleton (no body of their own), every bone
// the people's own clips move, and no scale tracks. (How the poses look is checked by eye on tests/clips.html.)
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const MODELS = new URL('../models/', import.meta.url);
// the JSON part of a .glb (the file's description: its nodes, clips and so on; the keys themselves are compressed)
function glb(path) {
  const b = fs.readFileSync(new URL(path, MODELS));
  assert.equal(b.toString('ascii', 0, 4), 'glTF', path + ' is not a .glb');
  return JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
}

// the clips, how long each lasts (seconds) and whether it loops. The riding loops are exactly as long as the horse's
// Walk and Gallop, so the rider and the horse play at one speed and stay in step.
const WANT = { Lasso_Swing: [1.0, 'loop'], Lasso_Throw: [0.8, 'once'], Lasso_Pull: [1.2, 'loop'], Ride: [35 / 30, 'loop'], Ride_Gallop: [0.6, 'loop'] };
const length = (g, a) => Math.max(...a.samplers.map((s) => g.accessors[s.input].max[0]));
const clip = (g, name) => g.animations.find((a) => a.name === name);
// "node.path" for every channel of a clip
const channels = (g, a) => a.channels.map((c) => g.nodes[c.target.node].name + '.' + c.target.path);

for (const body of ['m', 'f']) {
  test(`clips_${body}.glb: the five clips, their lengths, the skeleton only`, () => {
    const g = glb(`people/clips_${body}.glb`);
    assert.deepEqual(g.animations.map((a) => a.name).sort(), Object.keys(WANT).sort(), 'exactly these clip names');
    for (const [name, [secs]] of Object.entries(WANT)) {
      assert.ok(Math.abs(length(g, clip(g, name)) - secs) < 0.002, `${name} lasts ${length(g, clip(g, name))} s, want ${secs}`);
    }
    assert.ok(!g.meshes && !g.skins, 'no body, no skin: only the bones and the clips');
  });

  test(`clips_${body}.glb moves the same bones as the ${body === 'm' ? "men's" : "women's"} own clips, and never scales one`, () => {
    const g = glb(`people/clips_${body}.glb`), own = glb(`people/anims_${body}.glb`);
    const bones = new Set(own.nodes.map((n) => n.name));
    const idle = new Set(channels(own, clip(own, 'Idle')).filter((c) => !c.endsWith('.scale')));
    for (const name of Object.keys(WANT)) {
      const mine = channels(g, clip(g, name));
      assert.ok(!mine.some((c) => c.endsWith('.scale')), name + ': no scale tracks (they would undo a person\'s own sizing)');
      for (const c of mine) assert.ok(bones.has(c.slice(0, c.lastIndexOf('.'))), `${name}: ${c} is a bone of anims_${body}`);
      const set = new Set(mine);
      for (const c of idle) assert.ok(set.has(c), `${name} drives ${c} (Idle does: a bone left out would keep the last clip's pose)`);
      // both the turn and the place of every bone it moves
      for (const c of mine) {
        const bone = c.slice(0, c.lastIndexOf('.'));
        assert.ok(set.has(bone + '.rotation') && set.has(bone + '.translation'), `${name}: ${bone} has a rotation and a translation`);
      }
    }
  });
}

test('the riding loops last exactly as long as the horse\'s Walk and Gallop (the pack horse\'s and the steed\'s)', () => {
  const { kinds } = JSON.parse(fs.readFileSync(new URL('animals/animals.json', MODELS)).toString());
  for (const body of ['m', 'f']) {
    const g = glb(`people/clips_${body}.glb`);
    for (const kind of ['horse', 'steed']) {
      assert.ok(Math.abs(length(g, clip(g, 'Ride')) - kinds[kind].clips.Walk) < 0.002, `Ride vs the ${kind}'s Walk`);
      assert.ok(Math.abs(length(g, clip(g, 'Ride_Gallop')) - kinds[kind].clips.Gallop) < 0.002, `Ride_Gallop vs the ${kind}'s Gallop`);
    }
  }
});

test('the hand the rope leaves from is there on both skeletons', () => {
  for (const body of ['m', 'f']) {
    const names = new Set(glb(`people/anims_${body}.glb`).nodes.map((n) => n.name));
    for (const b of ['Wrist.R', 'Middle1.R', 'Wrist.L', 'Hips']) assert.ok(names.has(b), `${body}: ${b}`);
  }
});
