// THE SHIP'S DASHBOARD (src/dash.js, its numbers; src/fleet.js `dash`, where each ship's display stands): the fuel goes
// down as the ship flies and never runs out, however long the run; how far and how long count what is flown from the
// lift-off; the words are plain numbers with their units; every ship's display is in front of its pilot, below the
// window and clear of the screen's edges and the phone's buttons, in the seat's own view. No browser: plain numbers.
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

// ── each ship's display in its seat's own view: a plain camera at the pilot's eyes looking where the seat looks ──
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], unit = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
function onScreen(eye, look, fov, aspect, p) {
  const f = unit(sub(look, eye)), r = unit(cross(f, [0, 1, 0])), u = cross(r, f), v = sub(p, eye), z = dot(v, f), t = Math.tan(fov * Math.PI / 360);
  return [0.5 + dot(v, r) / z / (t * aspect) / 2, 0.5 - dot(v, u) / z / t / 2];
}
// (the display's glasses along the dashboard's curve, as src/flying.js stands them: their corners in the kit frame)
const cutsOf = (d) => D.dashCuts(D.dashLayout(1024, Math.round(1024 * d.h / d.w)));
const panelsOf = (s, d) => D.dashPanels(s, d.arc, cutsOf(d));
const cornersOf = (s, d) => panelsOf(s, d).flatMap((q) => q.corners);
// (each of its places: the pilot's and the other seat's (none of its own: the pilot's across the ship), wide and held
// upright, with the eyes and the look of that seat)
const across = (q) => ({ ...q, at: [-q.at[0], q.at[1], q.at[2]] }), acrossV = (v) => [-v[0], v[1], v[2]];
function placesOf(cfg) {
  const d = cfg.dash, st = cfg.seat, r = d.rider, out = [];
  for (const [who, m] of [['the pilot', 1], ['riding in the other seat', -1]]) {
    const wide = m > 0 ? d : r || across(d), tall = m > 0 ? d.tall : r ? r.tall || r : across(d.tall), eye = m > 0 ? st.eye : acrossV(st.eye), mv = (v) => (m > 0 ? v : acrossV(v));
    // (riding, there are no buttons at the bottom but View, at the far right, and no keys: lower, short of it)
    out.push([who, '1280 x 800', wide, eye, mv(st.look), st.fov, 1.6, m > 0 ? { x0: 0.23, x1: 0.97, y0: 0.55, y1: 0.925 } : { x0: 0.23, x1: 0.89, y0: 0.55, y1: 0.96 }]);
    // (on a phone on its side, between the sticks and above the help's tab in the middle: riding, beside the tab)
    out.push([who, '860 x 400', wide, eye, mv(st.look), st.fov, 2.15, m > 0 ? { x0: 0.17, x1: 0.83, y0: 0.55, y1: 0.905 } : { x0: 0.17, x1: 0.83, y0: 0.55, y1: 0.96, tab: { x0: 0.44, x1: 0.56, y0: 0.89 } }]);
    out.push([who, '400 x 860', tall, eye, mv(st.lookTall), st.fovTall, 400 / 860, { x0: 0.02, x1: 0.98, y0: 0.45, y1: 0.68 }]);
  }
  return out;
}
const SHIPS = [...F.SHIPS.map((s) => [s.id, F.flightOf(s.id)]), ['miner at the rocks', M.FIELD]];
test('every ship\'s display stands in front of the crew member, below the window, clear of the screen\'s edges, the help, the buttons and a phone\'s buttons', () => {
  for (const [id, cfg] of SHIPS) {
    const d = cfg.dash;
    for (const k of ['arc', 'at', 'w', 'h', 'lean']) assert.ok(d[k] !== undefined, `${id}: its display's ${k}`);
    assert.ok(d.tall, id + ': and where it stands on a screen held upright');
    // (the same display: the same shape, its size as that place has it)
    for (const [what, q] of [['held upright', d.tall], ['in front of the other seat', d.rider], ['in front of the other seat, held upright', d.rider && d.rider.tall]]) if (q) assert.ok(Math.abs(q.w / q.h - d.w / d.h) < 0.06 * d.w / d.h, `${id}: the same shape ${what} (${(d.w / d.h).toFixed(2)}, ${(q.w / q.h).toFixed(2)})`);
    for (const [who, size, s, eye, look, fov, aspect, box] of placesOf(cfg)) {
      const c = cornersOf(s, d).map((p) => onScreen(eye, look, fov, aspect, p));
      for (const [fx, fy] of c) assert.ok(fx > box.x0 && fx < box.x1 && fy > box.y0 && fy < box.y1 && !(box.tab && fx > box.tab.x0 && fx < box.tab.x1 && fy > box.tab.y0), `${id}, ${who}, at ${size}: a corner at ${fx.toFixed(3)}, ${fy.toFixed(3)} is inside ${JSON.stringify(box)}`);
      // (in front of the eyes and below them: it stands on the dashboard)
      for (const p of cornersOf(s, d)) assert.ok(p[2] > eye[2] + 0.4 && p[1] < eye[1], `${id}, ${who}, at ${size}: in front of the crew member and below the eyes`);
    }
  }
});

test('the display is curved as the dashboard is: three glasses along its curve, each turned to face its middle, meeting edge to edge', () => {
  for (const [id, cfg] of SHIPS) {
    const d = cfg.dash;
    for (const s of [d, d.tall, d.rider, d.rider && d.rider.tall].filter(Boolean)) {
      const P = panelsOf(s, d), r = Math.hypot(s.at[0], s.at[2] - d.arc);
      assert.equal(P.length, 3, id + ': the tiny ship, the speed and the fuel, and the rest, each a glass of its own');
      for (const q of P) {
        // (its two ends on the curve, at the display's own height; facing the curve's middle)
        for (const c of [q.corners[0], q.corners[2]]) assert.ok(Math.abs(Math.hypot(c[0], c[2] - d.arc) - r) < 1e-9 && Math.abs(c[1] - s.at[1]) < 1e-12, `${id}: a glass's ends on the curve`);
        const face = [-Math.sin(q.phi), 0, -Math.cos(q.phi)], toMid = unit([-q.foot[0], 0, d.arc - q.foot[2]]);
        assert.ok(dot(face, toMid) > 0.999999, `${id}: a glass faces the curve's middle`);
      }
      // (turned one after the other, port to starboard as the seat sees them, and their edges meet)
      assert.ok(P[0].phi > P[1].phi && P[1].phi > P[2].phi, id + ': turned in turn along the curve');
      for (let i = 0; i < 2; i++) { const a = P[i].corners[0], b = P[i + 1].corners[2]; assert.ok(Math.hypot(...sub(a, b)) < 1e-9, `${id}: glass ${i + 1} meets glass ${i + 2}`); }
      // (as long along the curve as the display is: its glasses' widths, a hair shorter than their arcs)
      const sum = P.reduce((n, q) => n + q.w, 0); assert.ok(sum < s.w && sum > s.w * 0.995, `${id}: its glasses' widths ${sum.toFixed(3)} for ${s.w}`);
    }
  }
});

// ── THE ROW ON THE DASHBOARD'S TOP: the kit's own screens (its COCKPIT_BANK, read from its source as the kit has it)
// and the flying's display between them ──
const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
function kitOf(id) {
  const kit = read(`../kit/ships/${id}-built.js`), cfg = F.flightOf(id), floor = +kit.match(/export const COCKPIT = \{ floor: ([\d.]+)/)[1], deck = cfg.seat.eye[1] - floor - 1.27;
  const bm = kit.match(/export const COCKPIT_BANK = (\{.*\});/), BANK = bm ? Function('return ' + bm[1])() : undefined;
  const C = Function('DECK', 'COCKPIT_BANK', 'return ' + kit.match(/export const COCKPIT = (\{.*\});/)[1])(deck, BANK);
  return { C, base: deck + floor, bank: B.shipBank(C, deck + floor) };
}
// (a flat panel standing along a circle about (0, cz): its ends at x0, x1, its feet at y, h tall leaning back by lean)
function standing(cz, r, x0, x1, y, h, lean) {
  const out = [];
  for (const x of [x0, x1]) { const ph = Math.asin(x / r), f = [x, y, cz + r * Math.cos(ph)], up = [Math.sin(lean) * Math.sin(ph), Math.cos(lean), Math.sin(lean) * Math.cos(ph)]; out.push(f, f.map((v, k) => v + up[k] * h)); }
  return out;
}
// (where a display's feet reach along the top: its glasses' bottom corners)
const spanOf = (s, d) => { const P = panelsOf(s, d), xs = P.flatMap((q) => [q.corners[0][0], q.corners[2][0]]); return [Math.min(...xs), Math.max(...xs)]; };
test('the life support and the terminal stand up on the dashboard\'s top, the display between them: one row, on one curve, at one level', () => {
  const rows = F.SHIPS.map((s) => [s.id, kitOf(s.id)]).filter(([, k]) => k.bank);
  assert.deepEqual(rows.map(([id]) => id), ['miner', 'medic'], 'the Miner and the Medic (the Explorer\'s display stands on its face of screens: no room beside it, tests below)');
  for (const [id, K] of rows) {
    const d = F.flightOf(id).dash, S = B.dashShape(B.cockpitDash({ seats: 2, gap: K.C.gap, canopy: K.C.canopy, dash: K.C.dash }));
    assert.deepEqual(K.bank.screens.map((q) => q.face), ['bars', 'text'], id + ': the life support and the terminal (the screen the questions called the radar)');
    // ONE CURVE: the display's about the dashboard's own arc, its feet as far out as the kit's screens', at their level
    assert.ok(Math.abs(d.arc - K.bank.cz) < 1e-4, `${id}: the display's curve is the dashboard's (${d.arc} and ${K.bank.cz.toFixed(5)})`);
    const r = Math.hypot(d.at[0], d.at[2] - d.arc);
    assert.ok(Math.abs(r - K.bank.r) < 0.003, `${id}: its feet where the kit's screens' are, as far along the top (${r.toFixed(4)}, ${K.bank.r.toFixed(4)})`);
    assert.ok(d.at[1] - K.bank.y > 0.005 && d.at[1] - K.bank.y < 0.02, `${id}: standing on the top as they do (its case's foot on it: ${d.at[1]}, the top ${K.bank.y.toFixed(4)})`);
    assert.ok(Math.abs(d.lean - K.bank.lean) < 1e-9, id + ': leaning back as they do');
    // ON THE TOP: the kit's screens on the deck itself (not the hood), within the dashboard's ends
    assert.ok(K.bank.s > S.fe + 0.06 && K.bank.s < S.depth, id + ': their feet on the top deck');
    const end = K.bank.r * Math.sin(S.T) + 0.002;
    for (const q of K.bank.screens) assert.ok(q.x0 > -end && q.x1 < end, `${id}: the ${q.face} screen within the dashboard's ends`);
    // THE ROW: the life support, the display, the terminal, then the other seat's display; a little gap between each
    const [ls, tm] = K.bank.screens, [p0, p1] = spanOf(d, d), [r0, r1] = spanOf(d.rider, d);
    const gaps = [['the life support', 'the display', ls.x0 - p1], ['the display', 'the terminal', p0 - tm.x1], ['the terminal', 'the other seat\'s display', tm.x0 - r1]];
    for (const [a, b, g] of gaps) assert.ok(g > 0.005 && g < 0.04, `${id}: ${a} and ${b} side by side (${(g * 100).toFixed(1)} cm apart)`);
    assert.ok(r0 > -end, id + ': the other seat\'s display within the dashboard\'s end');
  }
});

test('from the seat the whole row is in view, at 1280 x 800 and on a phone on its side; held upright, the kit\'s screens never cover the display', () => {
  for (const id of ['miner', 'medic']) {
    const cfg = F.flightOf(id), K = kitOf(id), d = cfg.dash;
    for (const [who, size, s, eye, look, fov, aspect] of placesOf(cfg)) {
      const kitBoxes = K.bank.screens.map((q) => { const c = standing(K.bank.cz, K.bank.r, q.x0, q.x1, K.bank.y, q.hb, K.bank.lean).map((p) => onScreen(eye, look, fov, aspect, p)); return { face: q.face, x0: Math.min(...c.map((v) => v[0])), x1: Math.max(...c.map((v) => v[0])), y0: Math.min(...c.map((v) => v[1])), y1: Math.max(...c.map((v) => v[1])) }; });
      if (size === '400 x 860') {
        // (the display held upright stands further along the top than they do: where one is in front of it, it is
        // below the display's foot)
        const c = cornersOf(s, d).map((p) => onScreen(eye, look, fov, aspect, p)), D0 = { x0: Math.min(...c.map((v) => v[0])), x1: Math.max(...c.map((v) => v[0])), y1: Math.max(...c.map((v) => v[1])) };
        for (const k of kitBoxes) if (k.x1 > D0.x0 && k.x0 < D0.x1) assert.ok(k.y0 > D0.y1, `${id}, ${who}, held upright: the ${k.face} screen's top (${k.y0.toFixed(3)}) below the display's foot (${D0.y1.toFixed(3)})`);
        continue;
      }
      // (the pilot sees both, whole: the help corner at the bottom left kept clear)
      if (who !== 'the pilot') continue;
      for (const k of kitBoxes) assert.ok(k.x0 > (size === '1280 x 800' ? 0.225 : 0.17) && k.x1 < 0.97 && k.y0 > 0.55 && k.y1 < 0.975, `${id} at ${size}: the ${k.face} screen in view (${[k.x0, k.y0, k.x1, k.y1].map((v) => v.toFixed(3))})`);
    }
  }
});

test('the drill\'s own Miner at the rocks: its cockpit stands 13 cm higher in its frame, and so does its display, in every one of its places', () => {
  const a = M.MINER.dash, b = M.FIELD.dash;
  for (const [x, y] of [[a, b], [a.tall, b.tall], [a.rider, b.rider], [a.rider.tall, b.rider.tall]]) {
    assert.ok(Math.abs(y.at[1] - x.at[1] - M.FIELD_UP) < 1e-9 && y.at[0] === x.at[0] && y.at[2] === x.at[2] && y.w === x.w && y.h === x.h && y.lean === x.lean, 'the same place, 13 cm higher');
  }
  assert.equal(b.arc, a.arc, 'on the same curve');
});

test('the Explorer\'s display stands on its face of screens, curved along it; its face keeps its own screens', () => {
  const K = kitOf('explorer'), d = F.flightOf('explorer').dash, S = B.dashShape(B.cockpitDash({ seats: 2, gap: K.C.gap, canopy: K.C.canopy, dash: K.C.dash }));
  assert.equal(K.bank, null, 'no row on its top');
  assert.ok(Math.abs(d.arc - (K.C.seatsZ + K.C.gap - S.R)) < 1e-4, 'its curve is the dashboard\'s');
  const s = Math.hypot(d.at[0], d.at[2] - d.arc) - S.R;
  assert.ok(s > S.fs && s < S.fe, `its foot on the face of screens (${s.toFixed(3)} forward of the near edge)`);
});
