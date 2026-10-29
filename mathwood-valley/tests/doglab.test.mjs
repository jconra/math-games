// The Dog Lab's data: the morph's sliders and rigs (src/actors/morphplan.js), the coat's painting rules and pattern
// pictures (src/actors/dogcoat.js), the breeds (src/actors/dogbreeds.js, models/animals/dogbreeds.json), and that the
// game takes a breed id for a dog. (The reshaping itself needs three.js and a browser: labs/dogs, and the rigs in
// ~/pw/bandit-math/rigs/doglab, which also check every breed's paws through every clip.)
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MORPH, MORPH_KEYS, EAR_SETS, RIGS, rigFor, rigBones, fillMorph, planMorph, growthOf } from '../src/actors/morphplan.js';
import { COAT, COAT_KEYS, fillCoat, paintFace, patternPixels, hexToLinear, linearToHex, PATTERNS } from '../src/actors/dogcoat.js';
import { BREEDS, BREED_ORDER, BASES, LATER, isBreed, breedOf, cleanBreed } from '../src/actors/dogbreeds.js';
import { homeDogs } from '../src/cabin/slots.js';

const MODELS = new URL('../models/', import.meta.url);
const glbNodes = (path) => { const b = fs.readFileSync(new URL(path, MODELS)); const j = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))); return (j.nodes || []).map((n) => String(n.name || '').replace(/[.]/g, '')); };
const source = (path) => fs.readFileSync(new URL(path, import.meta.url)).toString();

test('every slider has a sensible range, and filling a morph keeps it in range', () => {
  for (const [k, [lo, hi, step, def, label, group]] of Object.entries(MORPH)) {
    assert.ok(lo < hi && step > 0 && def >= lo && def <= hi, k);
    assert.ok(label && ['body', 'head', 'ears', 'tail'].includes(group), k);
  }
  const m = fillMorph({ body: 9, snout: -3, legFront: 'x', ears: null });
  assert.equal(m.body, MORPH.body[1]); assert.equal(m.snout, MORPH.snout[0]); assert.equal(m.legFront, 1); assert.equal(m.ears, 1);
  assert.deepEqual(Object.keys(m).sort(), [...MORPH_KEYS].sort());
  // a plain morph changes nothing
  const p = planMorph({}, RIGS.quat);
  assert.deepEqual(Object.values(p.bones).filter((b) => b.F.length || b.turn.length || b.move.length), []);
});

test('the rigs match the dogs on disk: the shiba, the husky and the wolf on one, the pug on the other', () => {
  for (const [file, rig] of [['animals/shiba.glb', 'quat'], ['animals/husky.glb', 'quat'], ['animals/wolf.glb', 'quat'], ['animals/farm/pug.glb', 'farm']]) {
    const names = glbNodes(file);
    assert.equal(rigFor(names) && rigFor(names).id, rig, file);
    for (const b of rigBones(RIGS[rig])) assert.ok(names.includes(b), `${file} has ${b}`);
  }
});

test('the morph plan: legs lengthen along the chain, the snout and ears and tail as asked, ears follow a head they hang beside', () => {
  const p = planMorph({ legFront: 0.8, legBack: 1.2, body: 1.3, ears: 1.5, earFold: 1, tailLength: 0.2, snout: 0.4, neckTilt: 0.5 }, RIGS.quat);
  assert.equal(growthOf(p.bones.FrontUpperLegL).along, 0.8);
  assert.equal(growthOf(p.bones.BackLowerLegR).along, 1.2);
  assert.equal(growthOf(p.bones.FrontShoulderL).along, 1);      // (the shoulder is inside the body: it doesn't lengthen)
  assert.equal(growthOf(p.bones.Torso2).along, 1.3);
  assert.equal(growthOf(p.bones.Ear2L).along, 1.5);
  assert.ok(p.bones.Ear3L.turn.length && p.bones.Ear3R.turn.length);
  assert.equal(p.bones.Ear1L.follow, 'Head');
  assert.ok(p.bones.Neck1.turn.some(([a, x, how]) => a === 'side' && x > 0 && how === 'pre'));
  assert.ok(p.bones.Head.turn.some(([a, x]) => a === 'side' && x < 0));   // (the head turned back level)
  assert.equal(p.snout.length, 0.4);
  // mirrored: the left and right ears splay opposite ways
  const q = planMorph({ earSplay: 1 }, RIGS.quat), l = q.bones.Ear1L.turn.find((t) => t[0] === 'fwd'), r = q.bones.Ear1R.turn.find((t) => t[0] === 'fwd');
  assert.ok(l && r && Math.sign(l[1]) === -Math.sign(r[1]));
  // the pug's rig has no ear or tail bones: the plan says so
  const f = planMorph({ ears: 1.4 }, RIGS.farm);
  assert.ok(f.earsMissing && f.tailMissing);
  // every ear set's numbers are morph sliders
  for (const [k, set] of Object.entries(EAR_SETS)) for (const n of Object.keys(set)) if (n !== 'label') assert.ok(MORPH[n], `${k}.${n}`);
});

// a face as dogkind.js measures it
const face = (o) => ({ part: 'body', h: 0.6, u: 0.5, s: 0.5, n: [1, 0, 0], side: 1, feature: 0, along: 0, noise: 0.2, rand: 0.5, head: null, ...o });
const head = (o) => ({ u: 0.5, v: 0.5, x: 0, eyeU: 0.27, eyeV: 0.75, eyeX: 0.5, stopU: 0.34, nose: 0.5, ...o });

test('coats: the recipe fills in range, colours go to light and back', () => {
  const c = fillCoat({ blaze: 3, base: 'red', pattern: 'stripes', seed: 0 });
  assert.equal(c.blaze, 1); assert.equal(c.base, COAT.base[1]); assert.equal(c.pattern, 'none'); assert.equal(c.seed, 1);
  assert.deepEqual(Object.keys(c).sort(), [...COAT_KEYS].sort());
  for (const hex of ['#141110', '#f2efe8', '#a5642c']) assert.equal(linearToHex(hexToLinear(hex)), hex);
});

test("coats: a Boston's tuxedo lands where it should", () => {
  const boston = breedOf('boston').coatFull, W = (f) => paintFace(f, boston).layer;
  assert.equal(W(face({ part: 'head', n: [0, 0, 1], head: head({ u: 0.9, v: 0.4, x: 0.1 }) })), 'white');            // the muzzle
  assert.equal(W(face({ part: 'head', n: [0, 0.3, 0.9], head: head({ u: 0.3, v: 0.8, x: 0.05 }) })), 'white');       // the blaze between the eyes
  assert.equal(W(face({ part: 'head', n: [0.9, 0.3, 0.2], head: head({ u: 0.25, v: 0.85, x: 0.85 }) })), 'base');    // the side of the skull
  assert.equal(W(face({ part: 'neck', n: [0, -0.6, 0.6], along: 0.5 })), 'white');                                  // the throat
  assert.equal(W(face({ part: 'chest', u: 0.95, s: 0.2, n: [0, 0, 1], h: 0.7 })), 'white');                          // the bib
  assert.equal(W(face({ part: 'chest', u: 0.7, s: 0.95, n: [1, 0, 0], h: 0.7 })), 'base');                           // the chest's side
  assert.equal(W(face({ part: 'body', u: 0.4, s: 0.6, n: [0, 1, 0], h: 1 })), 'base');                               // the back
  assert.equal(W(face({ part: 'pawF', h: 0.05 })), 'white');                                                          // a front foot
  assert.equal(W(face({ part: 'legF', h: 0.5 })), 'base');                                                            // up the leg
  // the model's own eyes are kept; its nose takes the nose colour
  assert.equal(paintFace(face({ part: 'head', feature: 1, head: head({ u: 0.3, nose: 0.3 }) }), boston).layer, 'eye');
  assert.equal(paintFace(face({ part: 'head', feature: 1, head: head({ u: 0.95, nose: 0.95 }) }), boston).layer, 'nose');
  // the family's dog: white front socks to the wrist, only white toes behind
  const fam = breedOf('bostonFamily').coatFull;
  assert.equal(paintFace(face({ part: 'legF', h: 0.15 }), fam).layer, 'white');     // (the wrist: about 0.16 of the withers' height)
  assert.equal(paintFace(face({ part: 'legF', h: 0.3 }), fam).layer, 'base');
  assert.equal(paintFace(face({ part: 'legB', h: 0.15 }), fam).layer, 'base');
  assert.equal(paintFace(face({ part: 'pawB', h: 0.02 }), fam).layer, 'white');
});

test('coats: a saddle on the back, tan points on the legs, a white tail tip, a fine pattern only where it belongs', () => {
  const beagle = breedOf('beagle').coatFull;
  assert.equal(paintFace(face({ part: 'body', u: 0.5, s: 0.3, n: [0, 1, 0], h: 1 }), beagle).layer, 'dark');
  assert.equal(paintFace(face({ part: 'tail', along: 0.95 }), beagle).layer, 'white');
  const heeler = breedOf('cattleDog').coatFull;
  assert.equal(paintFace(face({ part: 'legF', h: 0.3 }), heeler).layer, 'tan');
  assert.ok(paintFace(face({}), heeler).pattern);                       // (ticking over all of it)
  const brindle = breedOf('bostonBrindle').coatFull;
  assert.ok(paintFace(face({}), brindle).pattern);                      // brindle on the base colour ...
  assert.ok(!paintFace(face({ part: 'pawF', h: 0.02 }), brindle).pattern);   // ... not on the white
  assert.ok(!paintFace(face({}), breedOf('boston').coatFull).pattern);
});

test('pattern pictures: the same every time for a seed, a clear white spot, about the right cover', () => {
  for (const [kind] of PATTERNS) {
    if (kind === 'none') continue;
    const a = patternPixels(kind, { size: 64, seed: 3 }), b = patternPixels(kind, { size: 64, seed: 3 });
    assert.deepEqual(a.data, b.data, kind);
    const [u, v] = a.white, x = Math.floor(u * 64), y = Math.floor(v * 64);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) assert.equal(a.data[((y + dy) * 64 + x + dx) * 4], 255, kind + ' white spot');
    assert.ok(a.cover > 0.04 && a.cover < 0.7, `${kind} covers ${a.cover.toFixed(2)}`);
  }
});

test('breeds: every one is made from a dog the game has, the Boston terrier first, the saved file sound', () => {
  assert.equal(BREED_ORDER[0], 'boston');
  for (const id of BREED_ORDER) assert.ok(isBreed(id), id);
  for (const [id, b] of Object.entries(BREEDS)) {
    assert.ok(BASES.includes(b.base), id);
    assert.ok(EAR_SETS[b.ears], id + ' ears');
    for (const k of Object.keys(b.morph)) assert.ok(MORPH[k], `${id} morph ${k}`);
    for (const k of Object.keys(b.coat)) assert.ok(COAT[k], `${id} coat ${k}`);
    // cleaning is stable (what is saved reads back the same)
    assert.deepEqual(cleanBreed(cleanBreed(b)), cleanBreed(b), id);
  }
  // the first slice: the Boston (on both bases, the family's dog), a border collie, a heeler, labradors, a beagle, a dalmatian
  for (const id of ['boston', 'bostonPug', 'bostonFamily', 'borderCollie', 'cattleDog', 'labYellow', 'labBlack', 'labChocolate', 'beagle', 'dalmatian']) assert.ok(BREEDS[id], id);
  assert.equal(BREEDS.boston.ears, 'bat'); assert.equal(BREEDS.bostonPug.base, 'pug'); assert.ok(BREEDS.bostonFamily.collar);
  assert.ok(LATER.length >= 7);
  // the saved file: v 1, every breed in it cleans to itself
  const file = JSON.parse(fs.readFileSync(new URL('animals/dogbreeds.json', MODELS)));
  assert.equal(file.v, 1); assert.equal(typeof file.breeds, 'object');
  for (const [id, b] of Object.entries(file.breeds)) assert.deepEqual(cleanBreed(b), b, 'saved ' + id);
});

test('breeds: the saved one wins, a slider put back to its ear set is left out of the file', () => {
  const saved = { v: 1, breeds: { boston: cleanBreed({ ...BREEDS.boston, morph: { ...BREEDS.boston.morph, snout: 0.9 } }) } };
  assert.equal(breedOf('boston', saved).morphFull.snout, 0.9);
  assert.equal(breedOf('beagle', saved).morphFull.earSplay, BREEDS.beagle.morph.earSplay);
  const b = cleanBreed({ base: 'shiba', ears: 'bat', morph: { ears: EAR_SETS.bat.ears, body: 1.2 } });
  assert.deepEqual(b.morph, { body: 1.2 });
  assert.equal(breedOf('bat', { breeds: { bat: b } }).morphFull.ears, EAR_SETS.bat.ears);
  assert.equal(breedOf('nope'), null);
});

test('the game takes a breed for a dog: makeDog, the cabin and the animal library know them', () => {
  const dog = source('../src/dog.js');
  assert.match(dog, /dogKind = \(kind\) => \(DOG_KINDS\.includes\(kind\) \|\| isBreed\(kind\)/);
  assert.match(source('../src/actors/animals.js'), /needBreed\(lib, kind\)/);
  const home = homeDogs({ owned: { dog: { kind: 'boston', name: 'Rosie' }, dogs: [{ kind: 'shiba', name: 'Biscuit' }, { kind: 'wolfhound', name: 'X' }] } });
  assert.deepEqual(home.map((d) => d.kind), ['boston', 'shiba']);
  // not in the store yet (the game's maker decides once he's seen them)
  assert.doesNotMatch(source('../src/shop.js'), /boston/i);
});
