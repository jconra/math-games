// Checks that what the player, the seat, the lasso and the dog take for granted is really in the files on disk: the clip
// names and lengths (the rider's clip is kept in step with the horse's, and the rope is let go partway through the
// throw), the bones the code names, the saddles and horses it loads, and the seat offset the riding clips were built
// for. (How it all looks and plays is checked by eye: tests/play.html and the rigs in ~/pw/bandit-math/rigs/play*.cjs.)
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const GAME = new URL('../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, GAME));
const source = (path) => read(path).toString();
// the JSON part of a .glb (its nodes, clips and so on)
function glb(path) {
  const b = read(path);
  assert.equal(b.toString('ascii', 0, 4), 'glTF', path + ' is not a .glb');
  return JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
}
// each clip's length in seconds (its last key), by name
function clipLengths(g) {
  const out = {};
  for (const a of g.animations || []) out[a.name] = Math.max(...a.samplers.map((s) => g.accessors[s.input].max[0]));
  return out;
}
// three.js drops the dots from node names (Wrist.R becomes WristR); a clip's tracks are named after them
const clean = (name) => String(name || '').replace(/[.]/g, '');
const nodeNames = (g) => new Set((g.nodes || []).map((n) => clean(n.name)));
// a constant written in a source file as `name: number` or `name = number`
function constant(path, name) {
  const m = source(path).match(new RegExp(`\\b${name}\\s*[:=]\\s*(-?[0-9.]+)`));
  assert.ok(m, `${name} not found in ${path}`);
  return +m[1];
}
const animals = JSON.parse(source('models/animals/animals.json')).kinds;

test('the lasso and riding clips are there for both skeletons, as long as the code expects', () => {
  const horse = clipLengths(glb('models/animals/horse.glb'));
  const swingS = constant('src/player.js', 'SWING_S'), swing = constant('src/lasso.js', 'swing'), release = constant('src/lasso.js', 'release');
  for (const body of ['m', 'f']) {
    const c = clipLengths(glb(`models/people/clips_${body}.glb`));
    for (const name of ['Lasso_Swing', 'Lasso_Throw', 'Lasso_Pull', 'Ride', 'Ride_Gallop']) assert.ok(c[name] > 0, `${name} in clips_${body}.glb`);
    // the rider's clip is set to the same place in the stride as the horse's every frame: only when they are as long
    assert.ok(Math.abs(c.Ride - horse.Walk) < 0.02, `Ride ${c.Ride} s against the horse's Walk ${horse.Walk} s`);
    assert.ok(Math.abs(c.Ride_Gallop - horse.Gallop) < 0.02, `Ride_Gallop ${c.Ride_Gallop} s against the horse's Gallop ${horse.Gallop} s`);
    // the loop overhead turns once with the hand in one Lasso_Swing; the rope is let go as the arm comes through, inside the throw
    assert.ok(Math.abs(c.Lasso_Swing - swingS) < 0.01 && Math.abs(c.Lasso_Swing - swing) < 0.01, `Lasso_Swing ${c.Lasso_Swing} s`);
    assert.ok(release > 0.3 && release < 0.5 && release < c.Lasso_Throw, `the rope let go at ${release} s of a ${c.Lasso_Throw} s throw`);
  }
});

test('from the saddle the riding clip keeps the legs and the lasso clip takes the rest', () => {
  // player.js cuts a clip in two by its tracks' bone names: the hips and legs, and everything else
  const legs = new RegExp(source('src/player.js').match(/const LEGS = \/(.+)\/;/)[1]);
  const g = glb('models/people/clips_m.glb'), ride = g.animations.find((a) => a.name === 'Ride');
  const bones = [...new Set(ride.channels.map((c) => clean(g.nodes[c.target.node].name)))];
  const legBones = bones.filter((b) => legs.test(b + '.quaternion'));
  for (const b of ['Hips', 'UpperLegL', 'UpperLegR', 'LowerLegL', 'LowerLegR', 'FootL', 'FootR']) assert.ok(legBones.includes(b), b + ' kept from the riding clip');
  for (const b of ['Abdomen', 'Chest', 'WristR', 'UpperArmL', 'Head']) assert.ok(bones.includes(b) && !legBones.includes(b), b + ' taken by the lasso clip');
});

test('the bones the code names are in the models', () => {
  // the rope leaves the right fist (Wrist.R to Middle1.R), the body turns at the waist (Abdomen) to throw from the saddle
  for (const file of ['models/people/farmer_m.glb', 'models/people/adventurer_f.glb']) {
    const names = nodeNames(glb(file));
    for (const b of ['Hips', 'Abdomen', 'WristR', 'Middle1R', 'UpperLegL', 'LowerLegL', 'FootL', 'Head']) assert.ok(names.has(b), `${b} in ${file}`);
  }
  // the horse: its seat bone and the bone the loop goes round; the dogs: the back legs folded to sit
  for (const kind of ['horse', 'horseWhite', 'cow', 'bull']) {
    const k = animals[kind], names = nodeNames(glb('models/animals/' + k.file));
    assert.ok(names.has(k.seat.bone) && names.has(k.lasso.bone), `${kind}: ${k.seat.bone}, ${k.lasso.bone}`);
    assert.ok(k.lasso.radius > 0.05 && k.lasso.radius < 0.5, `${kind} neck radius ${k.lasso.radius} m`);
  }
  for (const kind of ['shiba', 'husky']) {
    const names = nodeNames(glb('models/animals/' + animals[kind].file));
    for (const b of ['BackLegL', 'BackLegR', 'BackLowerLegL', 'BackLowerLegR']) assert.ok(names.has(b), `${b} in ${kind}`);
    const c = clipLengths(glb('models/animals/' + animals[kind].file));
    for (const name of ['Idle', 'Walk', 'Gallop']) assert.ok(c[name] > 0, `${kind} ${name}`);
  }
});

test('the saddles and horses a rider can own are on disk', () => {
  const p = source('src/player.js');
  const saddles = Object.fromEntries([...p.match(/SADDLE_FILES = \{([^}]+)\}/)[1].matchAll(/(\w+): '(\w+)'/g)].map((m) => [m[1], m[2]]));
  assert.deepEqual(Object.keys(saddles).sort(), ['plain', 'silver', 'tooled'], 'the shop\'s three saddles (save.js: owned.saddle)');
  for (const f of Object.values(saddles)) assert.equal(glb(`models/saddles/${f}.glb`).asset.version, '2.0');
  const horses = [...p.match(/HORSE_KINDS = \{([^}]+)\}/)[1].matchAll(/(\w+): '(\w+)'/g)].map((m) => m[2]);
  assert.ok(horses.length >= 2);
  for (const kind of horses) assert.ok(animals[kind], kind + ' in animals.json');
});

test('the rider sits at the offset the riding clips were built for', () => {
  const nums = (s) => s.split(',').map(Number);
  const seat = nums(source('src/actors/seat.js').match(/RIDER_FROM_SADDLE = \[([^\]]+)\]/)[1]);
  const clips = nums(source('tests/clips.html').match(/RIDER_FROM_SADDLE = new THREE\.Vector3\(([^)]+)\)/)[1]);
  assert.deepEqual(seat, clips);
  assert.deepEqual(seat, [0, -0.61, -0.065]);
});
