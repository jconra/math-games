// THE SHIP'S DASHBOARD (src/dash.js, its numbers; src/fleet.js `dash`, where each ship's display stands): the fuel goes
// down as the ship flies and never runs out, however long the run; how far and how long count what is flown from the
// lift-off; the words are plain numbers with their units; every ship's display is in front of its pilot, below the
// window and clear of the screen's edges and the phone's buttons, in the seat's own view. No browser: plain numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../src/dash.js';
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

// ── each ship's display in its seat's own view: a plain camera at the pilot's eyes looking where the seat looks ──
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], unit = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
function onScreen(eye, look, fov, aspect, p) {
  const f = unit(sub(look, eye)), r = unit(cross(f, [0, 1, 0])), u = cross(r, f), v = sub(p, eye), z = dot(v, f), t = Math.tan(fov * Math.PI / 360);
  return [0.5 + dot(v, r) / z / (t * aspect) / 2, 0.5 - dot(v, u) / z / t / 2];
}
// (the display's four corners in the kit frame, as src/flying.js stands it)
function cornersOf(s) {
  const t = s.turn || 0, up = [Math.sin(s.lean) * Math.sin(t), Math.cos(s.lean), Math.sin(s.lean) * Math.cos(t)], across = [Math.cos(t), 0, -Math.sin(t)], out = [];
  for (const a of [-0.5, 0.5]) for (const b of [0, 1]) out.push([0, 1, 2].map((k) => s.at[k] + across[k] * a * s.w + up[k] * b * s.h));
  return out;
}
test('every ship\'s display stands in front of its pilot, below the window, clear of the screen\'s edges, the help, the buttons and a phone\'s buttons', () => {
  const ships = [...F.SHIPS.map((s) => [s.id, F.flightOf(s.id)]), ['miner at the rocks', M.FIELD]];
  for (const [id, cfg] of ships) {
    const d = cfg.dash, st = cfg.seat;
    for (const k of ['at', 'w', 'h', 'lean']) assert.ok(d[k] !== undefined, `${id}: its display's ${k}`);
    assert.ok(d.tall, id + ': and where it stands on a screen held upright');
    // (the same display: the same shape, its size as that place has it)
    assert.ok(Math.abs(d.tall.w / d.tall.h - d.w / d.h) < 0.06 * d.w / d.h, `${id}: the same shape held upright (${(d.w / d.h).toFixed(2)}, ${(d.tall.w / d.tall.h).toFixed(2)})`);
    for (const [size, s, look, fov, aspect, box] of [
      ['1280 x 800', d, st.look, st.fov, 1.6, { x0: 0.23, x1: 0.97, y0: 0.55, y1: 0.925 }],
      ['860 x 400', d, st.look, st.fov, 2.15, { x0: 0.17, x1: 0.83, y0: 0.55, y1: 0.905 }],
      ['400 x 860', d.tall, st.lookTall, st.fovTall, 400 / 860, { x0: 0.02, x1: 0.98, y0: 0.45, y1: 0.68 }],
    ]) {
      const c = cornersOf(s).map((p) => onScreen(st.eye, look, fov, aspect, p));
      for (const [fx, fy] of c) assert.ok(fx > box.x0 && fx < box.x1 && fy > box.y0 && fy < box.y1, `${id} at ${size}: a corner at ${fx.toFixed(3)}, ${fy.toFixed(3)} is inside ${JSON.stringify(box)}`);
      // (in front of the eyes and below them: it stands on the dashboard)
      for (const p of cornersOf(s)) assert.ok(p[2] > st.eye[2] + 0.4 && p[1] < st.eye[1], `${id} at ${size}: in front of the pilot and below the eyes`);
    }
  }
});
