// THE SHIP'S DASHBOARD (src/dash.js, its numbers; src/fleet.js `dash`, the flight's screen each ship's kit sets into its
// dashboard): the fuel goes down as the ship flies and never runs out, however long the run; how far and how long count
// what is flown from the lift-off; the words are plain numbers with their units; every ship's three screens are set
// into its dashboard and whole from the seat, the flight's screen clear of the page's buttons; the life-size blue ship
// only while landing. No browser: plain numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as D from '../src/dash.js';
import * as B from '../kit/shipparts/cockpit/bank.js';
import * as F from '../src/fleet.js';
import * as M from '../src/flymodel.js';
import { stationSolid } from '../src/flysolid.js';

const DT = 1 / 60;

test('a full tank and nothing flown at the start; standing on the pad uses nothing and counts nothing', () => {
  const d = D.makeDash();
  assert.deepEqual([d.fuel, d.dist, d.secs, d.speed], [1, 0, 0, 0]);
  for (let i = 0; i < 600; i++) D.stepDash(d, { p: [42.3, 0, -5], dt: DT, flying: false });
  assert.deepEqual([d.fuel, d.dist, d.secs], [1, 0, 0], 'ten seconds on the pad, its power on or off');
  const rows = D.dashRows(d, null);
  assert.deepEqual(rows.map((r) => r.id), ['speed', 'fuel', 'dist', 'time'], 'no canisters on a flight with no run');
  assert.deepEqual(rows.map((r) => r.value + (r.unit ? ' ' + r.unit : '')), ['0 m/s', '100 %', '0 m', '0 s']);
});

test('how far and how fast: what is flown, from the lift-off; a place changed (the jump) adds nothing', () => {
  const d = D.makeDash();
  // (straight along at 10 m/s for 3 s)
  for (let t = 0; t < 3 - 1e-9; t += DT) D.stepDash(d, { p: [t * 10, 2, 0], dt: DT, flying: true });
  assert.ok(Math.abs(d.dist - (3 - DT) * 10) < 1e-6, `30 m flown (${d.dist})`);
  assert.ok(Math.abs(d.speed - 10) < 0.01, `10 m/s (${d.speed})`);
  assert.ok(Math.abs(d.secs - 3) < 0.02, 'three seconds from the lift-off');
  // (the jump: the ship is somewhere else at once: nothing flown, and it is not going 6000 m/s)
  const was = d.dist;
  D.stepDash(d, { p: [6000, 2, 0], dt: DT, flying: true });
  assert.equal(d.dist, was, 'the jump adds nothing to how far');
  assert.equal(d.speed, 0);
  // (down on a floor: the time goes on, nothing more flown)
  D.stepDash(d, { p: [6000, 2, 1], dt: DT, flying: false });
  assert.equal(d.dist, was);
  assert.ok(d.secs > 3);
});

test('the fuel: it goes down as the ship flies, never up, and never runs out however long anyone flies', () => {
  const d = D.makeDash(); let last = d.fuel, x = 0;
  // an hour of flying flat out, 40 m/s, turning about
  for (let t = 0; t < 3600; t += 1 / 30) {
    x += 40 / 30;
    D.stepDash(d, { p: [Math.cos(x / 500) * 500, 3, Math.sin(x / 500) * 500], dt: 1 / 30, flying: true });
    assert.ok(d.fuel <= last + 1e-12, 'never up');
    assert.ok(d.fuel > D.FUEL.floor, 'never down to the floor');
    last = d.fuel;
  }
  assert.ok(d.fuel < D.FUEL.low, 'it did go down (to ' + D.fuelText(d.fuel) + '%)');
  assert.ok(+D.fuelText(d.fuel) >= 12, 'the gauge still shows some (' + D.fuelText(d.fuel) + '%)');
  // (the burn itself: the same sum in pieces as at once, and slower below LOW)
  assert.ok(Math.abs(D.burn(D.burn(1, 0.4), 0.4) - D.burn(1, 0.8)) < 1e-12, 'burning in two pieces is the same as at once');
  assert.ok(1 - D.burn(1, 0.1) > D.burn(0.25, 0) - D.burn(0.25, 0.1), 'slower when low');
});

// the autopilot flying a plan to its end
function autofly(S, plan, solid, each, most = 240) {
  let t = 0;
  while (t < most) {
    const C = M.fly(S, plan, DT);
    if (!C && !S.settle) break;
    M.stepShip(S, C || M.noControls(), DT, solid); t += DT; each();
    if (S.landed && t > 1 && plan.every((l) => l.down)) break;
  }
  return t;
}

test('a whole mining run, flown: the Miner out by the autopilot, the jump, a long while at the rocks, the jump home and in to land: the fuel goes down all the way and there is plenty left', () => {
  const cfg = F.flightOf('miner'), solid = stationSolid({ bay: cfg.bay, bays: cfg.others.map((o) => o.bay) }), d = D.makeDash();
  const S = M.makeShip(cfg), seen = [];
  const each = (flying = !S.landed) => { D.stepDash(d, { p: S.p, dt: DT, flying }); seen.push(d.fuel); };
  // the welcome, on the pad, then out: the leave
  for (let i = 0; i < 120; i++) each(false);
  M.setPower(S, true);
  const out = autofly(S, M.planLeave(S, solid), solid, () => each());
  assert.ok(M.clearOf(S.p), 'clear of the station');
  const atClear = { fuel: d.fuel, dist: d.dist };
  assert.ok(d.dist > 100 && d.fuel < 1, `out of the station: ${D.distText(d.dist).join(' ')} flown, the tank at ${D.fuelText(d.fuel)}% (${out.toFixed(0)} s)`);
  // the jump's cards, holding outside (a minute), then the wormhole: the place changes
  for (let i = 0; i < 60 * 60; i++) each(true);
  const R = M.makeFieldShip([0, 0, 0], [0, 0, 1]);
  // at the rocks: three minutes (the longest of flying-4's whole runs spent under two there), flown by hand from rock to
  // rock a quarter of the time (forward, turning), holding by a rock the rest
  const hold = new Set(['forward', 'right']);
  for (let i = 0; i < 180 * 60; i++) { M.stepShip(R, M.controlsOf(i % 1200 < 300 ? hold : new Set()), DT, null); D.stepDash(d, { p: R.p.map((v) => v + 50000), dt: DT, flying: true }); seen.push(d.fuel); }
  // the jump home: outside the station, in sight of it, and in to land by the autopilot
  const A = M.arrival(cfg); M.place(S, A.p, A.q);
  const home = autofly(S, M.planLand(S, solid), solid, () => each());
  assert.ok(M.onPad(S), `down on its pad (${home.toFixed(0)} s)`);
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] <= seen[i - 1] + 1e-12, 'the fuel never goes up');
  assert.ok(d.fuel < atClear.fuel && d.dist > atClear.dist + 100, 'it went on going down at the rocks and home');
  assert.ok(d.fuel > 0.4 && d.fuel < 0.9, `clearly gone down, and plenty left after a long run: ${D.fuelText(d.fuel)}%, ${D.distText(d.dist).join(' ')} flown, ${D.timeText(d.secs)}`);
  console.log(`# a long mining run: the tank at ${D.fuelText(d.fuel)}%, ${D.distText(d.dist).join(' ')} flown, ${D.timeText(d.secs)}`);
  // (the jump itself flew nothing: everything flown is the station's leave, the rocks and the way home)
  assert.ok(d.dist < 20000, 'the jump adds nothing to how far: ' + D.distText(d.dist).join(' '));
});

test('the words: plain numbers with their units, the canisters on a run', () => {
  assert.deepEqual(D.distText(0), ['0', 'm']); assert.deepEqual(D.distText(850.4), ['850', 'm']); assert.deepEqual(D.distText(1234), ['1.2', 'km']); assert.deepEqual(D.distText(250000), ['250', 'km']);
  assert.equal(D.timeText(0), '0 s'); assert.equal(D.timeText(35.9), '35 s'); assert.equal(D.timeText(155), '2 min 35 s'); assert.equal(D.timeText(3725), '1 h 2 min');
  assert.equal(D.speedText(12.4), '12'); assert.equal(D.speedText(-0.2), '0'); assert.equal(D.fuelText(0.866), '87');
  const d = D.makeDash(); d.dist = 1500; d.secs = 75; d.speed = 7.6; d.fuel = 0.5;
  const rows = D.dashRows(d, { cans: [3, 8] });
  assert.deepEqual(rows.map((r) => [r.label, r.value, r.unit]), [['SPEED', '8', 'm/s'], ['FUEL', '50', '%'], ['DISTANCE', '1.5', 'km'], ['CANISTERS FULL', '3 of 8', ''], ['FLIGHT TIME', '1 min 15 s', '']]);
  assert.equal(rows.find((r) => r.id === 'fuel').gauge, 0.5, 'the gauge beside the number');
});

// ── THE SCREENS SET INTO THE DASHBOARD (each ship's kit, its COCKPIT_UP read from its source as the kit has it:
// kit/shipparts/cockpit/bank.js shipUp), and the flight's screen among them (src/fleet.js `dash`), in each seat's own
// view: a plain camera at the eyes looking where the seat looks ──
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], unit = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
function onScreen(eye, look, fov, aspect, p) {
  const f = unit(sub(look, eye)), r = unit(cross(f, [0, 1, 0])), u = cross(r, f), v = sub(p, eye), z = dot(v, f), t = Math.tan(fov * Math.PI / 360);
  return [0.5 + dot(v, r) / z / (t * aspect) / 2, 0.5 - dot(v, u) / z / t / 2];
}
const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
function kitOf(id) {
  const kit = read(`../kit/ships/${id}-built.js`), cfg = F.flightOf(id), floor = +kit.match(/export const COCKPIT = \{ floor: ([\d.]+)/)[1], deck = cfg.seat.eye[1] - floor - 1.27;
  const um = kit.match(/^const COCKPIT_UP = (\{.*\});/m), UP = um ? Function('return ' + um[1])() : undefined;
  const C = Function('DECK', 'COCKPIT_UP', 'return ' + kit.match(/export const COCKPIT = (\{.*\});/)[1])(deck, UP);
  return { C, base: deck + floor, K: B.shipUp(C, deck + floor) };
}
// (a screen's bezel's corners, kit frame: across it, up it from its picture's middle)
function bezel(q) {
  const ac = unit(cross(q.up, q.n)), hw = q.w / 2 + B.MFD_BEZEL, out = [];
  for (const a of [-hw, hw]) for (const b of [-(q.h / 2 + B.MFD_BEZEL + B.MFD_KEYS), q.h / 2 + B.MFD_BEZEL]) out.push(q.mid.map((v, k) => v + ac[k] * a + q.up[k] * b));
  return out;
}
const boxOf = (pts, view) => { const c = pts.map((p) => onScreen(view.eye, view.look, view.fov, view.aspect, p)); return { x0: Math.min(...c.map((v) => v[0])), x1: Math.max(...c.map((v) => v[0])), y0: Math.min(...c.map((v) => v[1])), y1: Math.max(...c.map((v) => v[1])) }; };
const fmt = (b) => [b.x0, b.y0, b.x1, b.y1].map((v) => v.toFixed(3)).join(', ');
const inside = (b, o) => b.x0 > o.x0 && b.x1 < o.x1 && b.y0 > o.y0 && b.y1 < o.y1;
const overlaps = (b, o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0;
const SCREEN = { x0: 0, x1: 1, y0: 0, y1: 1 };
// (the page's own boxes (src/flying.js CSS, CSS px), as fractions of a W x H screen: on a wide screen the help corner
// at the bottom left (its card over its tab) and the row of buttons at the bottom right, seated (the widest: Power, Lift
// off, Autopilot, View, Controls); on a phone, the Help tab at the bottom middle and the sticks in the bottom corners
// (flying by hand), the Up, Down and Roll buttons over them)
const pageOf = (W, H) => W > 640 && H > 480 ? [['the help corner', { x0: 0, x1: 282 / W, y0: (H - 155) / H, y1: 1 }], ['the buttons', { x0: (W - 627) / W, x1: 1, y0: (H - 58) / H, y1: 1 }]]
  : [['the Help tab', { x0: (W / 2 - 32) / W, x1: (W / 2 + 32) / W, y0: (H - 40) / H, y1: 1 }], ['the left stick', { x0: 0, x1: 136 / W, y0: (H - 140) / H, y1: 1 }], ['the right stick', { x0: (W - 136) / W, x1: 1, y0: (H - 140) / H, y1: 1 }],
    ['the Up and Down buttons', { x0: 0, x1: 150 / W, y0: (H - 216) / H, y1: (H - 168) / H }], ['the Roll buttons', { x0: (W - 190) / W, x1: 1, y0: (H - 216) / H, y1: (H - 168) / H }]];
const SHIPS = F.SHIPS.map((s) => s.id);
const views = (cfg, who = 'pilot') => {
  const st = cfg.seat, pilot = who === 'pilot', wide = F.seatView(st, { pilot }), tall = F.seatView(st, { pilot, tall: true });
  return [['1280 x 800', { ...wide, aspect: 1.6, W: 1280, H: 800 }], ['1920 x 1080', { ...wide, aspect: 16 / 9, W: 1920, H: 1080 }], ['860 x 400', { ...wide, aspect: 2.15, W: 860, H: 400 }], ['400 x 860', { ...tall, aspect: 400 / 860, W: 400, H: 860 }]];
};

test('every ship\'s flight screen is its dashboard\'s own middle screen: the life support, the flight\'s screen and the terminal set into it, side by side along its curve', () => {
  for (const id of SHIPS) {
    const { K } = kitOf(id), d = F.flightOf(id).dash;
    assert.ok(K, id + ': its kit sets its screens into its dashboard (COCKPIT_UP)');
    assert.deepEqual(K.screens.map((q) => q.face), ['bars', 'flight', 'text'], id + ': the life support, the flight\'s screen, the terminal, port to starboard');
    const q = K.screens[1];
    // (the flying's numbers are shown exactly over the kit's screen)
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(d.at[k] - q.mid[k]) < 2e-5, `${id}: the flight's screen where the kit's is (${d.at} and ${q.mid.map((v) => v.toFixed(5))})`);
    assert.ok(Math.abs(d.w - q.w) < 1e-9 && Math.abs(d.h - q.h) < 2e-5 && Math.abs(d.lean - q.lean) < 2e-5 && Math.abs(d.arc - K.cz) < 2e-5, `${id}: as wide, as tall, leaning and turned as the kit's`);
    // (facing the middle of the dashboard's curve, as the flying turns its glass)
    const phi = Math.atan2(d.at[0], d.at[2] - d.arc), n = [-Math.cos(d.lean) * Math.sin(phi), Math.sin(d.lean), -Math.cos(d.lean) * Math.cos(phi)];
    assert.ok(dot(n, q.n) > 0.99999, id + ': facing as the kit\'s screen faces');
    // (side by side, a little gap between each, within the dashboard's ends)
    for (let i = 0; i < 2; i++) { const g = K.screens[i].x0 - K.screens[i + 1].x1; assert.ok(g > 0.01 && g < 0.06, `${id}: ${K.screens[i].face} and ${K.screens[i + 1].face} side by side (${(g * 100).toFixed(1)} cm apart)`); }
    const run = K.S.top, end = (K.S.R + run[1][0]) * Math.sin(K.S.T);
    for (const s of K.screens) assert.ok(s.x1 < end && s.x0 > -end, `${id}: the ${s.face} screen within the dashboard's ends`);
  }
  // (no sum on any dashboard: its middle screen is the flight's)
  assert.ok(!/'sum'/.test(read('../kit/shipparts/cockpit/consoles.js')), 'the dashboard draws no "6 x 7 = ?"');
});

test('the Miner\'s and the Medic\'s screens are set into a raised face of the dashboard\'s top, the Explorer\'s moved up in its own face; nothing stands on the top', () => {
  for (const id of SHIPS) {
    const { C, base, K } = kitOf(id), S = K.S, up = C.dash.up;
    assert.equal(C.dash.bank, undefined, id + ': no row standing on the top');
    if (id === 'explorer') { assert.equal(up.on, 'face', 'the Explorer: in its face'); assert.equal(S.rise, null); assert.deepEqual(S.top, S.face); }
    else {
      assert.ok(S.rise, id + ': a raised face');
      // (it steps up from the top behind the hood, leaning back, into the dashboard's own outline)
      const [[s0, y0], [s1, y1]] = S.rise, lean = Math.atan2(s1 - s0, y1 - y0);
      assert.ok(s0 > S.fe + 0.06 && s1 < S.depth && y1 > y0 + 0.15 && lean > 0.3 && lean < 0.6, `${id}: just behind the hood, leaning back ${lean.toFixed(2)}`);
      assert.ok(S.outline.some(([s, y, k]) => s === s1 && y === y1 && k === 'deck') && S.outline.some(([s, y, k]) => s === s0 && y === y0 && k === 'top'), id + ': part of the dashboard\'s own outline');
      // (its top under the line from the eyes to the windscreen's foot, or within a centimetre of it: the window kept)
      const z0 = C.seatsZ + C.gap, cfg = F.flightOf(id);
      for (const e of [cfg.seat.eye, cfg.seat.eyeTall]) {
        const yl = e[1] + (base + S.deckY - e[1]) * (z0 + s1 - e[2]) / (z0 + S.depth - e[2]);
        assert.ok(base + y1 < yl + 0.01, `${id}: the raised face's top (${(base + y1).toFixed(3)}) under the window's foot as the eyes see it (${yl.toFixed(3)})`);
      }
    }
    // (each screen set into its run: its picture just out of the face, its bezel within the face's length)
    const run = S.top, L = Math.hypot(run[1][0] - run[0][0], run[1][1] - run[0][1]), u = up.u;
    for (const q of K.screens) assert.ok(u - q.h / 2 - B.MFD_BEZEL - B.MFD_KEYS > 0 && u + q.h / 2 + B.MFD_BEZEL < L, `${id}: the ${q.face} screen within its face (${L.toFixed(3)} m long)`);
  }
});

test('from the pilot\'s seat every one of the three screens is whole, the flight\'s screen clear of the page\'s help, sticks and buttons; held upright, the flight\'s screen is whole above a phone\'s buttons', () => {
  for (const id of SHIPS) {
    const { K } = kitOf(id), cfg = F.flightOf(id);
    for (const [size, view] of views(cfg)) {
      // (each screen's whole bezel, its keys too)
      const boxes = K.screens.map((q) => [q.face, boxOf(bezel(q), view)]), fl = boxes[1][1];
      // (in front of the eyes and below them)
      for (const p of bezel(K.screens[1])) assert.ok(p[2] > view.eye[2] + 0.4 && p[1] < view.eye[1], `${id} at ${size}: the flight's screen ahead and below the eyes`);
      if (size === '400 x 860') {
        // (held upright: the flight's screen whole, in the middle of the narrow view, above the phone's buttons (the row
        // flying by hand at 586 px, the sticks' buttons below it) and below the page's top bar)
        assert.ok(inside(fl, { x0: 0.03, x1: 0.97, y0: 0.45, y1: 586 / 860 }), `${id} held upright: the flight's screen at ${fmt(fl)}`);
        assert.ok(Math.abs((fl.x0 + fl.x1) / 2 - 0.5) < 0.05, `${id} held upright: in the middle`);
      } else for (const [face, b] of boxes) assert.ok(inside(b, SCREEN), `${id} at ${size}: the ${face} screen whole (${fmt(b)})`);
      for (const [what, o] of pageOf(view.W, view.H)) {
        if (!overlaps(fl, o)) continue;
        // (the Explorer's, low in a wide view: the row of buttons stands above it there (src/flying.js, is-dash-btns),
        // over the dashboard's hood, below the middle of the window)
        assert.ok(id === 'explorer' && what === 'the buttons' && fl.y0 > 0.7, `${id} at ${size}: ${what} over the flight's screen (${fmt(fl)})`);
      }
    }
  }
});

test('riding in the Miner\'s other seat (the only seat anyone rides in), the flight\'s screen is whole too', () => {
  const { K } = kitOf('miner'), cfg = F.flightOf('miner');
  for (const [size, view] of views(cfg, 'rider')) {
    const b = boxOf(bezel(K.screens[1]), view);
    assert.ok(inside(b, size === '400 x 860' ? { x0: 0.03, x1: 0.97, y0: 0.45, y1: 586 / 860 } : SCREEN), `the other seat at ${size}: the flight's screen whole (${fmt(b)})`);
  }
});

test('the drill\'s own Miner at the rocks: its cockpit stands 13 cm higher in its frame, and so does its flight\'s screen', () => {
  const a = M.MINER.dash, b = M.FIELD.dash;
  assert.ok(Math.abs(b.at[1] - a.at[1] - M.FIELD_UP) < 1e-9 && b.at[0] === a.at[0] && b.at[2] === a.at[2] && b.w === a.w && b.h === a.h && b.lean === a.lean, 'the same screen, 13 cm higher');
  assert.equal(b.arc, a.arc, 'on the same curve');
});

test('landing (the life-size blue ship from behind only then): not on the pad, not flying out, from the jump home until it is down, never at the rocks', () => {
  const cfg = F.flightOf('miner'), solid = stationSolid({ bay: cfg.bay, bays: cfg.others.map((o) => o.bay) }), S = M.makeShip(cfg);
  const seen = (goal, everClear = false) => M.isLanding(S, { goal, everClear });
  assert.equal(seen('leave'), false, 'on the pad');
  M.setPower(S, true);
  let out = 0;
  autofly(S, M.planLeave(S, solid), solid, () => { if (seen('leave')) out++; });
  assert.ok(M.clearOf(S.p) && out === 0, 'never on the way out');
  const A = M.arrival(cfg); M.place(S, A.p, A.q);
  let n = 0, all = 0;
  autofly(S, M.planLand(S, solid), solid, () => { all++; if (seen('land') === !S.landed) n++; });
  assert.ok(M.onPad(S) && n === all && all > 100, `from the jump home: landing every frame until it is down, then not (${n} of ${all})`);
  assert.equal(seen('land'), false, 'down on its pad: not');
  // (the lab: once it has been out, flying back in is landing; a hop on the pad before that is not)
  const H = M.makeShip(cfg); M.setPower(H, true); H.landed = false;
  assert.equal(M.isLanding(H, { goal: 'free', everClear: false }), false, 'the lab: a hop before it has been out');
  assert.equal(M.isLanding(H, { goal: 'free', everClear: true }), true, 'the lab: back in after it has been out');
  assert.equal(M.isLanding(H, { goal: 'land', field: true }), false, 'at the rocks: never');
});
