// Checks the actors' files agree with each other: every animal, outfit and gun the game asks for is on disk, with the
// clips and bones the code names, at a believable size. (The looks themselves are checked by eye on tests/actors.html.)
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const MODELS = new URL('../models/', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, MODELS));
const json = (path) => JSON.parse(read(path).toString());
// the JSON part of a .glb (the file's description: its nodes, clips and so on)
function glb(path) {
  const b = read(path);
  assert.equal(b.toString('ascii', 0, 4), 'glTF', path + ' is not a .glb');
  return JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
}
// three.js drops the dots from node names (FrontShoulder.L becomes FrontShoulderL)
const nodeNames = (g) => new Set((g.nodes || []).map((n) => String(n.name || '').replace(/[.]/g, '')));
const source = (path) => fs.readFileSync(new URL(path, import.meta.url)).toString();

test('every animal is there, at its real size, with the clips and bones the game uses', () => {
  const { kinds } = json('animals/animals.json');
  const KINDS = ['horse', 'horseWhite', 'steed', 'donkey', 'cow', 'bull', 'deer', 'stag', 'shiba', 'husky', 'wolf'];
  assert.deepEqual(Object.keys(kinds).sort(), [...KINDS, ...FARM].sort());
  // (the game's own list, src/actors/animals.js KINDS, is the same)
  const listed = source('../src/actors/animals.js').match(/export const KINDS = \[([^\]]*)\]/)[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
  assert.deepEqual(listed, KINDS);
  // metres at the shoulder: what a saddle horse, a cow, a deer and the dogs really stand
  const SHOULDER = { horse: [1.5, 1.7], horseWhite: [1.5, 1.7], steed: [1.5, 1.7], donkey: [1.0, 1.3], cow: [1.3, 1.5], bull: [1.35, 1.65], deer: [1.0, 1.3],
    stag: [1.2, 1.5], shiba: [0.35, 0.45], husky: [0.5, 0.65], wolf: [0.65, 0.85] };
  for (const kind of KINDS) {
    const k = kinds[kind];
    assert.ok(k.scale > 0, kind + ' scale');
    assert.ok(k.height >= SHOULDER[kind][0] && k.height <= SHOULDER[kind][1], `${kind} stands ${k.height} m at the shoulder`);
    assert.ok(k.tall >= k.height * 0.95, kind + ': the head is no lower than the shoulder by much');
    assert.equal(k.facing, '+Z');
    const g = glb('animals/' + k.file), clips = (g.animations || []).map((a) => a.name);
    assert.deepEqual(clips.sort(), Object.keys(k.clips).sort(), kind + ': clips in animals.json match the file');
    for (const c of ['Idle', 'Walk', 'Gallop', 'Eating', 'Death']) assert.ok(clips.includes(c), kind + ' has ' + c);
    assert.ok(!clips.some((c) => c.includes('|')), kind + ': the duplicate Armature| clips are gone');
    const names = nodeNames(g);
    for (const b of [k.seat.bone, k.lasso.bone, k.head]) assert.ok(names.has(b), `${kind} has the bone ${b}`);
    assert.ok(k.stride.Walk > 0 && k.stride.Gallop > k.stride.Walk, kind + ' gallops faster than it walks');
    assert.equal(g.meshes.length, 1, kind + ': one mesh');
    if (k.coat) {
      // a coat kind (the steed): the body and its glossy eye, two primitives of the one mesh; the eye's material is the
      // one animals.json names, and the body's isn't it (src/actors/animals.js: the body is the biggest skinned mesh)
      const prims = g.meshes[0].primitives, mats = prims.map((pr) => g.materials[pr.material].name);
      assert.equal(prims.length, 2, kind + ': a body and an eye');
      assert.ok(mats.includes(k.eye) && mats.filter((m) => m === k.eye).length === 1, `${kind}: one eye primitive (${mats})`);
      const count = (pr) => g.accessors[pr.attributes.POSITION].count, body = prims.find((pr) => g.materials[pr.material].name !== k.eye);
      assert.ok(count(body) > 10 * count(prims.find((pr) => g.materials[pr.material].name === k.eye)), kind + ': the body is by far the bigger');
      for (const c of ['LookLeft', 'LookRight', 'Nod', 'HeadShake', 'EarFlick']) assert.ok(clips.includes(c), kind + ' has the stall clip ' + c);
      // the same skeleton and clips as the pack horse, at its scale (the seat, the strides and the riding clips were made for it)
      assert.equal(k.scale, kinds.horse.scale, kind + ': the pack horse\'s scale'); assert.deepEqual(k.seat, kinds.horse.seat, kind + ': the pack horse\'s seat');
      for (const [c, d] of Object.entries(kinds.horse.clips)) assert.equal(k.clips[c], d, `${kind}: ${c} as long as the pack horse's`);
    } else assert.equal(g.meshes[0].primitives.length, 1, kind + ': drawn in one go');
  }
});

// the farm pack (from the pack's .blend files): its own clip names, and the pug's dog clips
const FARM = ['farmCow', 'farmHorse', 'pig', 'sheep', 'pug'];
test('the farm animals are there, at their real size, with all six clips (and the pug its dog clips)', () => {
  const { kinds } = json('animals/animals.json');
  const SHOULDER = { farmCow: [1.3, 1.5], farmHorse: [1.5, 1.7], pig: [0.7, 0.9], sheep: [0.7, 0.9], pug: [0.25, 0.35] };
  for (const kind of FARM) {
    const k = kinds[kind];
    assert.ok(k, kind + ' in animals.json'); assert.ok(k.file.startsWith('farm/'), kind + ' lives in models/animals/farm/');
    assert.ok(k.scale > 0, kind + ' scale');
    assert.ok(k.height >= SHOULDER[kind][0] && k.height <= SHOULDER[kind][1], `${kind} stands ${k.height} m at the shoulder`);
    assert.ok(k.tall >= k.height * 0.95, kind + ': the head is no lower than the shoulder by much');
    assert.equal(k.facing, '+Z');
    const g = glb('animals/' + k.file), clips = (g.animations || []).map((a) => a.name);
    assert.deepEqual(clips.sort(), Object.keys(k.clips).sort(), kind + ': clips in animals.json match the file');
    for (const c of ['Idle', 'Walk', 'WalkSlow', 'Gallop', 'Jump', 'Death']) assert.ok(clips.includes(c), kind + ' has ' + c);
    if (kind === 'pug') for (const c of ['Trot', 'Sit_Down', 'Sit', 'Lie_Down', 'Lie']) assert.ok(clips.includes(c), 'the pug has ' + c);
    const names = nodeNames(g);
    for (const b of [k.seat.bone, k.lasso.bone, k.head]) assert.ok(names.has(b), `${kind} has the bone ${b}`);
    assert.ok(k.stride.Walk > 0 && k.stride.Gallop > k.stride.Walk, kind + ' gallops faster than it walks');
    if (kind === 'pug') assert.ok(k.stride.Trot > k.stride.Walk && k.gait && k.gait.trotAt > 0, 'the pug trots where the others walk');
    assert.equal(g.meshes.length, 1, kind + ': one mesh'); assert.equal(g.meshes[0].primitives.length, 1, kind + ': drawn in one go');
    assert.ok(g.meshes[0].primitives[0].attributes.COLOR_0 !== undefined, kind + ': its colours are in the vertices');
  }
});

test('every outfit is there, with the clips the game plays and the hat', () => {
  const meta = json('people/people.json');
  const OUTFITS = ['farmer_m', 'adventurer_m', 'adventurer_f', 'casual_m', 'casual_f', 'worker_m', 'suit_m', 'suit_f', 'formal_f'];
  assert.deepEqual(meta.people.map((p) => p.file).sort(), [...OUTFITS].sort());
  // folk.js names the same outfits
  const folk = source('../src/actors/folk.js');
  const listed = folk.match(/export const OUTFITS = \[([^\]]*)\]/)[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
  assert.deepEqual(listed.sort(), [...OUTFITS].sort());
  for (const p of meta.people) {
    const g = glb('people/' + p.file + '.glb');
    assert.equal(g.meshes.length, 1, p.file + ': one mesh');
    assert.ok(['m', 'f'].includes(p.body));
    assert.ok(nodeNames(g).has('Head') && nodeNames(g).has('Hips'), p.file + ' has the Head and Hips bones');
    assert.ok(!nodeNames(g).has('Pistol') && !nodeNames(g).has('Sword'), p.file + ': the pack\'s weapons are gone');
  }
  const WANT = ['Idle', 'Idle_Neutral', 'Walk', 'Run', 'Wave', 'Interact', 'Idle_Gun', 'Idle_Gun_Pointing', 'Gun_Shoot', 'Run_Shoot',
    'HitRecieve', 'Death', 'Roll', 'Run_Back', 'Run_Left', 'Run_Right'];
  for (const body of ['m', 'f']) {
    const clips = (glb(`people/anims_${body}.glb`).animations || []).map((a) => a.name);
    for (const c of WANT) assert.ok(clips.includes(c), `anims_${body} has ${c}`);
  }
  for (const [body, file] of Object.entries(meta.extraClips || {})) {
    assert.ok(['m', 'f'].includes(body)); assert.ok(glb('people/' + file).animations.length > 0, file + ' has clips');
  }
  assert.ok(glb('people/' + meta.hat.file + '.glb').meshes.length === 1, 'the hat');
});

test('the period palettes: eight of them, four colours each', () => {
  const folk = source('../src/actors/folk.js');
  const block = folk.match(/export const PALETTES = \{([\s\S]*?)\n\};/)[1];
  const pals = Object.fromEntries([...block.matchAll(/(\w+):\s*\[([^\]]*)\]/g)].map((m) => [m[1], m[2].match(/#[0-9a-f]{6}/gi)]));
  assert.deepEqual(Object.keys(pals).sort(), ['drifter', 'homestead', 'mustard', 'outlaw', 'prairie', 'rancher', 'sage', 'townsman']);
  for (const [name, cols] of Object.entries(pals)) assert.equal(cols.length, 4, name);
  // the outlaw reads as one of the gang: every colour dark
  const lum = (h) => { const n = parseInt(h.slice(1), 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
  for (const c of pals.outlaw) assert.ok(lum(c) < 0.3, 'outlaw ' + c + ' is dark');
});

test('the guns are there with their fire and reload clips', () => {
  const { guns } = json('guns/guns.json');
  assert.deepEqual(Object.keys(guns).sort(), ['Revolver', 'Rifle', 'Shotgun']);
  for (const [name, g] of Object.entries(guns)) {
    const clips = (glb('guns/' + g.file).animations || []).map((a) => a.name);
    assert.ok(clips.includes(g.clips.fire), name + ' fire'); assert.ok(clips.includes(g.clips.reload), name + ' reload');
    assert.ok(g.scale > 0 && g.length > 0.2 && g.length < 1.3, name + ' length');
  }
});

test('the saddles the rider sits on are there', () => {
  for (const s of ['basic', 'battle', 'fancy']) assert.ok(glb(`saddles/${s}.glb`).meshes.length >= 1, s);
});
