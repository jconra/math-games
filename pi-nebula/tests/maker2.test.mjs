// MAKER 2 (2026-11-26): the start screen while the game loads (the name typed and the character made from the first
// moment, only going aboard waiting for the load, no keyboard raised by itself on a phone, the figure as large as the
// window allows) and the crew's arms shorter and hands smaller, by the bones, every outfit alike. The screen and the
// crew kit run in the browser, so these read their sources.
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { armsFor, armBonePlaces } from '../kit/armlength.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const CREW = read('../kit/crew.js'), MAIN = read('../src/main.js'), ENGINE = read('../../shared/title/title.js');
const THEME = read('../src/ui/title.js'), CSS = read('../src/ui/title.css');

const ARM_LENGTH = new Function(`return ${/export const ARM_LENGTH = (\{[^\n]*\});/.exec(CREW)[1]};`)();

test('the arms are made shorter (never more than the 10% the game\'s maker named), the hands smaller, one setting for every outfit (THE ARMS ONE LENGTH stands)', () => {
  // (5%: the least the game's maker named; by the numbers 3% already brings the fingertips past half way down the
  // thigh, and he is asked which he likes: MAKER_2.md, QUESTIONS.md)
  assert.ok(ARM_LENGTH.arm >= 0.90 && ARM_LENGTH.arm < 1, `arm ${ARM_LENGTH.arm}`);
  // (his answer, MAKER2-1, 2026-11-27: "8% shorter"; a slip back to 0.95 fails here)
  assert.equal(ARM_LENGTH.arm, 0.92);
  assert.ok(ARM_LENGTH.hand > 0.8 && ARM_LENGTH.hand < 1, `hand ${ARM_LENGTH.hand}`);
  // (no outfit of its own: crew.json has no per-outfit arm length)
  const list = JSON.parse(read('../assets/crew/crew.json'));
  for (const s of list.parts.suit) assert.ok(!('armLength' in s), s.id);
});

test('by the bones, as a person is put together: after the shoulder width, and the clips fitted to the same shorter arms', () => {
  const mk = CREW.slice(CREW.indexOf('export async function makeCrew'));
  const sh = mk.indexOf('moveShoulders(tpl, fit.shoulderMoves)'), ar = mk.indexOf('shortenArms(tpl, fit.armLength');
  assert.ok(sh > 0 && ar > sh, 'the arms drawn in after the shoulders are moved');
  // (the clips' cache knows the setting, and the steps worked out at load are given the shorter arms' moves)
  assert.match(CREW, /key = id \+ '\|' \+ \(hand \|\| ''\) \+ '\|' \+ sh \+ '\|' \+ AL\.arm \+ '\|' \+ AL\.hand/);
  assert.match(CREW, /const moves = armMoves\(g\.scene, shoulders, hr, AL\);/);
  assert.match(CREW, /seatedArms\(cl, g\.scene, hg \? hg\.scene : null, rig, moves, [^\n]*, AL\);/);
});

test('the upper arm and the forearm are drawn in by the same share, so they keep a person\'s proportion to each other', () => {
  const f = CREW.slice(CREW.indexOf('function armMoves'), CREW.indexOf('function shortenArms'));
  assert.match(f, /for \(const n of \['LowerArm' \+ s, 'Wrist' \+ s\]\)[^\n]*multiplyScalar\(A\.arm - 1\)/);
  const g = CREW.slice(CREW.indexOf('function shortenArms'), CREW.indexOf('function armPoints'));
  assert.match(g, /la\.position\.fromArray\(Q\.lower\); wr\.position\.fromArray\(Q\.wrist\);/);
  // (kit/armlength.js: the elbow's and the wrist's places by the one share)
  const Q = armBonePlaces({ lower: [0, 0.3, 0], wrist: [0, 0.27, 0], under: {} }, { arm: 0.9, hand: 1 });
  assert.ok(Math.abs(Q.lower[1] / 0.3 - Q.wrist[1] / 0.27) < 1e-12);
});

test('the maker first: the crew kit and the first figure\'s files are fetched before the station starts loading', () => {
  const b = MAIN.slice(MAIN.indexOf('async function boot'));
  const first = b.indexOf('makerParts(lib, T)'), station = b.indexOf('await loadStation(');
  assert.ok(first > 0 && station > first, 'makerParts before loadStation');
  const wait = +/const MAKER_WAIT = (\d+);/.exec(MAIN)[1];
  assert.ok(wait >= 3000 && wait <= 20000, `the station waits at most ${wait} ms`);
});

test('no keyboard raised by itself on a phone: the name box takes the focus by itself only where there is a mouse', () => {
  assert.equal((ENGINE.match(/focusKey\('name'/g) || []).length, 1, 'the name box focused only through nameFocus');
  assert.match(ENGINE, /const nameFocus = \(scroll = true\) => \{ if \(!touchOnly\(\)\) focusKey\('name', scroll\); \};/);
  assert.match(ENGINE, /matchMedia\('\(pointer: coarse\)'\)/);
});

test('only going aboard waits for the load: the start button shows the loading and works the moment it is done', () => {
  assert.match(THEME, /loadingStart: \(pct\) => `GO ABOARD<small>loading \$\{pct\}%<\/small>`/);
  assert.match(ENGINE, /const loadShown = \(\) => typeof W\.loadingStart === 'function' && !ready\(\) && !S\.waiting && !S\.riding;/);
  // (pressed while loading it still waits and goes by itself; loaded, the button is drawn as ever)
  assert.match(ENGINE, /if \(S\.load\.f >= 1 && S\.waiting\) rideNow\(\);/);
  assert.match(ENGINE, /else if \(S\.load\.f >= 1 && actionsEl\.querySelector\(`\.\$\{P\}-ride\.is-loading`\)\) keepFocus\(renderActions\);/);
  // (and the figure's window says it is on its way until the real person is drawn)
  assert.match(THEME, /Getting your character ready/);
  assert.match(CSS, /\.cst-full\[data-live="ready"\] \.cst-waitwords \{ opacity: 0; \}/);
});

test('the figure as large as the window allows: on a wide window the card takes the height and the maker\'s window what that frees', () => {
  const i = CSS.indexOf('@media (min-width: 1101px) and (min-height: 561px)');
  assert.ok(i > 0);
  const block = CSS.slice(i, CSS.indexOf('\n}', i));
  assert.match(block, /\.cst-panel:has\(> \.cst-crew\) \{ flex: 1 1 auto;/);
  assert.match(block, /grid-template-rows: auto 1fr auto auto;/);
  assert.match(block, /\.cst-stage \{ height: auto;/);
});

// (a suit's bones from its GLB's own nodes: each one's place from its parent's joint, and its parent)
function suitBones(id) {
  const f = readFileSync(new URL(`../assets/crew/suit_${id}.glb`, import.meta.url)), n = f.readUInt32LE(12), j = JSON.parse(f.subarray(20, 20 + n).toString());
  const parent = {}; j.nodes.forEach((d, i) => (d.children || []).forEach((c) => (parent[c] = i)));
  return { nodes: j.nodes, parent, find: (name) => j.nodes.findIndex((d) => d.name === name) };
}
const len = (v) => Math.hypot(v[0], v[1], v[2]);

test('an android\'s own hands are drawn in toward a person\'s size (its handSize, MAKER2-2, Captain Vega\'s too); its arms are drawn in as everyone\'s', () => {
  // (the kit takes both from kit/armlength.js: the arms' length an outfit wears, and the bones' places drawn in)
  assert.match(CREW, /AL = armsFor\(E0, lib\.armLengthOf\(\)\);/);
  assert.match(CREW, /const Q = armBonePlaces\(\{ lower: la\.position\.toArray\(\), wrist: wr\.position\.toArray\(\), under:/);
  const list = JSON.parse(read('../assets/crew/crew.json'));
  // (Vega's own hand measured against his height as the androids' were: 0.143 of the head joint's height, theirs 0.133
  // to 0.151, a person's 0.109: as oversized as theirs, so the same)
  for (const id of ['androidDock', 'androidHeavy', 'androidOld', 'androidMedical', 'androidService', 'androidFeminine', 'vega']) {
    const s = list.parts.suit.find((x) => x.id === id); assert.ok(s.ownHands, id); assert.ok(s.handSize > 0.5 && s.handSize < 0.9, id);
    // the hand's bones themselves: every joint under the wrist at handSize of its place, the wrist and elbow at the arm's
    const A = armsFor(s, ARM_LENGTH), B = suitBones(id), wr = B.find('Wrist.R'), la = B.find('LowerArm.R');
    const under = {}; const walk = (i) => (B.nodes[i].children || []).forEach((c) => { under[B.nodes[c].name] = B.nodes[c].translation || [0, 0, 0]; walk(c); }); walk(wr);
    assert.ok(Object.keys(under).length >= 10, id + ': its fingers\' joints');
    const Q = armBonePlaces({ lower: B.nodes[la].translation, wrist: B.nodes[wr].translation, under }, A);
    // (the middle finger's length, the wrist's joint to its last joint, joint by joint)
    const finger = (P) => ['Middle1.R', 'Middle2.R', 'Middle3.R', 'Middle4.R'].reduce((t, k) => t + len(P[k]), 0);
    assert.ok(Math.abs(finger(Q.under) / finger(under) - s.handSize) < 1e-9, id + ': the hand drawn in to its handSize');
    assert.ok(Math.abs(len(Q.wrist) / len(B.nodes[wr].translation) - ARM_LENGTH.arm) < 1e-9, id + ': the forearm as everyone\'s');
  }
  // (a person's outfit, its hands from a hand part: everyone's hand size)
  assert.equal(armsFor(list.parts.suit.find((x) => x.id === 'crew1'), ARM_LENGTH).hand, ARM_LENGTH.hand);
  // (an outfit with hands of its own and no handSize keeps them as made)
  assert.equal(armsFor({ ownHands: true }, ARM_LENGTH).hand, 1);
});

test('the station is put together a piece at a time, the page given its turn between: rooms, light, shaders, walls, people', () => {
  const STATION = read('../src/station.js'), WALLS = read('../src/walls.js'), PEOPLE = read('../src/people.js'), LAYOUT = read('../kit/layout.js'), BAKE = read('../kit/bake.js');
  assert.match(STATION, /await buildRoomSoon\(R, mats, /);
  assert.match(LAYOUT, /export function buildRoom\(room, mats, opts = \{\}\) \{\n  const it = roomSteps\(room, mats, opts\);/);
  assert.match(STATION, /await cubeSoon\(cc, renderer, scene\)/);
  assert.doesNotMatch(STATION, /cc\.update\(renderer, scene\)/);
  assert.match(STATION, /export async function usePrograms\(renderer, root\)/);
  assert.match(MAIN, /const ahead = await wallsAhead\(W\.built, \{ apart: STANDS_ANYWHERE \}\);/);
  assert.match(WALLS, /const V = solid\.length \? \(A && A\.station\) \|\| makeVoxels\(solid, voxel\)/);
  assert.match(BAKE, /export async function makeVoxelsSoon\(/);
  assert.equal((PEOPLE.match(/await turn\(\);/g) || []).length, 3);
  // (a returning player's start button, drawn before the load starts, shows it from its first word)
  assert.match(ENGINE, /if \(first && loadShown\(\) && !actionsEl\.hidden\) keepFocus\(renderActions\);/);
  // (and the shaders built for what they draw into: the bloom's target)
  assert.match(MAIN, /W\.renderer\.setRenderTarget\(W\.target\(\)\);/);
});
