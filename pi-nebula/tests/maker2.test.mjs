// MAKER 2 (2026-11-26): the start screen while the game loads (the name typed and the character made from the first
// moment, only going aboard waiting for the load, no keyboard raised by itself on a phone, the figure as large as the
// window allows) and the crew's arms shorter and hands smaller, by the bones, every outfit alike. The screen and the
// crew kit run in the browser, so these read their sources.
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const CREW = read('../kit/crew.js'), MAIN = read('../src/main.js'), ENGINE = read('../../shared/title/title.js');
const THEME = read('../src/ui/title.js'), CSS = read('../src/ui/title.css');

const ARM_LENGTH = new Function(`return ${/export const ARM_LENGTH = (\{[^\n]*\});/.exec(CREW)[1]};`)();

test('the arms are made shorter (never more than the 10% the game\'s maker named), the hands smaller, one setting for every outfit (THE ARMS ONE LENGTH stands)', () => {
  // (5%: the least the game's maker named; by the numbers 3% already brings the fingertips past half way down the
  // thigh, and he is asked which he likes: MAKER_2.md, QUESTIONS.md)
  assert.ok(ARM_LENGTH.arm >= 0.90 && ARM_LENGTH.arm < 1, `arm ${ARM_LENGTH.arm}`);
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
  assert.match(g, /la\.position\.multiplyScalar\(A\.arm\); wr\.position\.multiplyScalar\(A\.arm\);/);
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

test('an android\'s own hands keep their size; its arms are drawn in as everyone\'s', () => {
  assert.match(CREW, /AL = \(lib\.entry\('suit', id\) \|\| \{\}\)\.ownHands \? \{ \.\.\.AL0, hand: 1 \} : AL0;/);
  const list = JSON.parse(read('../assets/crew/crew.json'));
  for (const id of ['androidDock', 'androidHeavy', 'androidOld', 'androidMedical', 'androidService', 'androidFeminine']) assert.ok(list.parts.suit.find((x) => x.id === id).ownHands, id);
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
