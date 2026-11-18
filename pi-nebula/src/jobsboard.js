// THE STATION'S JOBS BOARD, hung beside the captains' board in the terminal (kit/furniture.js jobs 'station'). The game's
// maker (2026-11-17): "We do have other jobs. Maybe we need another jobs board that lists local station jobs? I think we
// need the ability to click on them and get the glowing lines in the floor or colored lights to follow or something that
// can take us to the job we selected."
// AND ITS SMALL COPIES at a person's own height (kit/furniture.js jobs 'pair': the upper screen of each; the game's
// maker, of the big boards hung high: "It doesn't really seem like something that would be clickable ... it is more
// intuitive to think you can interact with something that is at your own level"). Every copy works as the big one
// does and shows the same picture: ONE canvas, one texture, one material for them all; the screens of one room are one
// mesh, so the copies cost a draw for each room that has one, while that room is drawn, and two triangles a screen.
// The board lists the station's own jobs, each with a line on what it is and where; the one picked is lit on it. Pick
// one by tapping or clicking its row on the board itself, or walk up to the board (a prompt comes up: E, or its button)
// and pick from the list that opens on the screen; a glowing line on the floor then leads from the player to that job
// (guide.js), and fades as they get there or when another is picked. The list has the board's own look.
// AND THE CAPTAINS HIRING, the other board (kit/furniture.js jobs 'hang', and the lower screen of each 'pair'). The
// game's maker (2026-11-18): "I was thinking they should all be able to be picked. Although the missions should lead
// you to the captain." A captain's line is picked as a job's is (its row on a screen, or from the same list, under
// the station's jobs), and the line it lays leads to that captain, wherever they are walking at the time (the guide
// follows them: guide.js `follow`); arriving, the captain makes their own offer as they do to anyone who walks up
// (people.js). A captain with no mission to pick (their ship in repair) keeps a line to read. The captains' picture
// is the kit's own (kit/tex.js captainsBoard), drawn again here on the lower half of the same one canvas so the row
// picked can be lit: still one texture, one material, and one mesh a room.
//
//   const board = makeJobsBoard({ W, walls, input, jobs, guide, asking, captains })   asking(): a question already up
//                 (a captain's); captains(): the people's captains ({ at(id), seek(id) }: people.js), or null before
//                 they are aboard
//   board.update(dt, P, playing)   each frame: the prompt near the board, the board's picture when the pick changes
//   board.open() / board.close() / board.pick(id) / board.stop()     (the rigs: GAME.board)
//   board.rows, board.picked, board.near, board.isOpen; board.captains (the captains' rows), board.hiring (where
//   they are in their picture: kit/tex.js HIRING_AT)
//   board.at (the spot under the big board), board.boards ([{ at, small, room }]: every board's spot, for the rigs)
import * as THREE from 'three';
import { piecesOf } from './people.js';
import { JOBS_SCREEN, JOBS_PAIR } from '../kit/furniture.js';
import { CREWS, HIRING, HIRING_AT, captainsBoard } from '../kit/tex.js';
import { CAPTAIN_ROWS, targetOf } from './boardpick.js';

// THE JOBS LISTED, in the board's order (the station's own: src/jobs/), each its colour, what it is and where it is
export const STATION_JOBS = [
  { id: 'galley', name: 'Galley kitchen', line: 'Cook up the diners\' orders', place: 'Terminal', colour: '#ffb347', hue: 'gold' },
  { id: 'medical', name: 'Triage desk', line: 'Help the patients who come in', place: 'Medical', colour: '#ff6a5a', hue: 'red' },
  { id: 'smelter', name: 'Smelter controls', line: 'Work out what a load of metal sells for', place: 'Smelter', colour: '#ff8a3a', hue: 'orange' },
  { id: 'crane', name: 'Crane operator', line: 'Check the crane\'s moves', place: 'Control room', colour: '#ffd35a', hue: 'yellow' },
  { id: 'dock', name: 'Docking bridge', line: 'Build the bridge out to a ship', place: 'Dock', colour: '#59c3ff', hue: 'blue' },
  { id: 'arena', name: 'Mathball', line: 'Throw number balls into the right goals', place: 'Arena', colour: '#b98cff', hue: 'purple' },
];
// near the board: how far from the spot under it the prompt comes up (m), and how much the view must be turned toward
// it (the dot of the camera's way and the way to the board, level); a row shorter than this on the screen (px) is too
// small for a finger: a tap on the board opens the list instead. A small copy on a wall: its prompt comes up
// `nearSmall` from the spot in front of it (`stand` out from the wall); a row too small on the screen for the mouse's
// pointer (`pointer`, px) opens the list too.
// (`sought`: seconds a captain walked up to keeps the first word after their line is done with; `ghost`: ms after a
// tap on a board opens the list in which the list takes no click)
export const BOARD = { near: 6.5, facing: 0.25, finger: 36, nearSmall: 2.6, stand: 0.95, pointer: 6, sought: 8, ghost: 300 };

const CSS = `
.pjb-prompt, .pjb, .pjb-chip { --ink: #eef1f4; --dim: #a7b0ba; --line: rgba(196, 220, 240, 0.36); --cyan: #59c3ff; --accent: #ff8f2e; --accent-ink: #1c1205; --cut: 12px;
  --oct: polygon(var(--cut) 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, var(--cut) 100%, 0 calc(100% - var(--cut)), 0 var(--cut));
  font: 400 16px/1.35 "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif; color: var(--ink); -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
.pjb-prompt *, .pjb *, .pjb-chip * { box-sizing: border-box; }
.pjb-prompt button, .pjb button, .pjb-chip button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }
.pjb-prompt { position: fixed; left: 50%; bottom: max(26px, env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 15; display: flex; align-items: center; gap: 12px;
  padding: 8px 8px 8px 18px; background: rgba(15, 19, 25, 0.9); box-shadow: inset 0 0 0 1.5px rgba(89, 195, 255, 0.55); clip-path: var(--oct); max-width: calc(100vw - 32px); }
.pjb-prompt[hidden], .pjb[hidden] { display: none; }
.pjb:focus { outline: none; }
.pjb-prompt .pjb-pw { display: flex; flex-direction: column; min-width: 0; }
.pjb-prompt .pjb-pw b { font-size: 14px; letter-spacing: 0.1em; text-transform: uppercase; color: #bfe6ff; }
.pjb-prompt .pjb-pw small { font-size: 13px; color: var(--dim); }
.pjb-open { flex: none; height: 44px; padding: 0 18px; font-size: 15px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #06202e !important; background: var(--cyan) !important; clip-path: var(--oct); --cut: 9px; }
.pjb kbd, .pjb-prompt kbd { font: 700 10px/1 inherit; font-family: inherit; padding: 3px 5px; margin-left: 8px; border-radius: 3px; background: rgba(0, 0, 0, 0.18); vertical-align: 2px; }
@media (hover: none) and (pointer: coarse) { .pjb kbd, .pjb-prompt kbd { display: none; } }
.pjb { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 20; width: min(580px, calc(100vw - 24px)); max-height: calc(100vh - 24px); overflow: auto;
  padding: 16px 16px 14px; background: linear-gradient(#10314a, #0d2638); box-shadow: inset 0 0 0 3px var(--cyan); clip-path: var(--oct); }
.pjb-head { display: flex; align-items: baseline; gap: 10px; margin: 0 2px 10px; padding-bottom: 8px; border-bottom: 2px solid rgba(89, 195, 255, 0.5); }
.pjb-head b { font-size: 24px; font-weight: 800; letter-spacing: 0.04em; color: #fff; }
.pjb-head small { flex: 1; font-size: 13px; color: #9fd8ff; letter-spacing: 0.06em; text-transform: uppercase; }
.pjb-x { flex: none; width: 40px; height: 40px; margin: -6px -6px 0 0; font-size: 22px !important; line-height: 1; color: #cfeaff !important; background: rgba(255, 255, 255, 0.06) !important; clip-path: var(--oct); --cut: 8px; }
.pjb-line { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.pjb-key { flex: none; width: 24px; margin: 0 !important; text-align: center; vertical-align: 0 !important; padding: 5px 0 !important; font-size: 12px !important; color: #cfeaff; background: rgba(89, 195, 255, 0.14) !important; }
.pjb-row { display: grid; grid-template-columns: 12px 1fr auto; align-items: center; column-gap: 12px; width: 100%; min-height: 56px; padding: 8px 12px 8px 10px; text-align: left;
  background: rgba(89, 195, 255, 0.1) !important; box-shadow: inset 0 0 0 1px rgba(89, 195, 255, 0.18); clip-path: var(--oct); --cut: 8px; }
.pjb-line:nth-child(even) .pjb-row { background: rgba(89, 195, 255, 0.05) !important; }
.pjb-row:hover, .pjb-row:focus-visible { background: rgba(89, 195, 255, 0.22) !important; outline: none; }
.pjb-row i { width: 12px; align-self: stretch; clip-path: polygon(0 0, 100% 3px, 100% calc(100% - 3px), 0 100%); }
.pjb-row span { display: flex; flex-direction: column; min-width: 0; }
.pjb-row b { font-size: 16px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; }
.pjb-row small { font-size: 14px; color: #cfeaff; }
.pjb-row em { font-style: normal; font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #ffe3a0; text-align: right; }
.pjb-line .pjb-row.is-on { background: rgba(89, 195, 255, 0.3) !important; box-shadow: inset 0 0 0 3px var(--job, var(--cyan)); }
.pjb-row.is-on em::before { content: '\\25B8 '; color: #fff; }
.pjb-sub { display: flex; align-items: baseline; gap: 10px; margin: 14px 2px 2px; padding-bottom: 6px; border-bottom: 2px solid rgba(89, 195, 255, 0.5); }
.pjb-sub b { font-size: 18px; font-weight: 800; letter-spacing: 0.04em; color: #fff; }
.pjb-sub small { font-size: 13px; color: #9fd8ff; letter-spacing: 0.06em; text-transform: uppercase; }
.pjb-line .pjb-row.is-off { cursor: default; opacity: 0.55; background: rgba(89, 195, 255, 0.05) !important; }
.pjb-row.is-off em { color: #9fb3c4; }
.pjb-foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 12px; font-size: 13px; color: #9fd8ff; }
.pjb-stop { height: 36px; padding: 0 14px; font-size: 13px !important; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #cfeaff !important; background: rgba(255, 255, 255, 0.07) !important; clip-path: var(--oct); --cut: 8px; }
.pjb-stop[hidden] { display: none; }
@media (max-height: 800px) { .pjb { padding-top: 10px; padding-bottom: 8px; } .pjb-head { margin-bottom: 4px; padding-bottom: 4px; } .pjb-line { margin-top: 4px; } .pjb-row { min-height: 42px; padding-top: 1px; padding-bottom: 1px; }
  .pjb-sub { margin-top: 8px; padding-bottom: 3px; } .pjb-foot { margin-top: 6px; } }
@media (max-width: 640px) { .pjb { top: auto; bottom: max(10px, env(safe-area-inset-bottom)); transform: translateX(-50%); padding: 12px 12px 10px; } .pjb-head b { font-size: 20px; } .pjb-row { min-height: 52px; } .pjb-row small { font-size: 13px; }
  .pjb-prompt { width: calc(100vw - 24px); } .pjb-prompt .pjb-pw { flex: 1; } }
.pjb-chip { position: fixed; left: 50%; top: max(12px, env(safe-area-inset-top)); transform: translateX(-50%); z-index: 14; display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 6px 0 14px;
  background: rgba(15, 19, 25, 0.88); box-shadow: inset 0 0 0 1.5px var(--chip, #59c3ff); clip-path: var(--oct); --cut: 9px; font-size: 14px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
  white-space: nowrap; width: max-content; max-width: calc(100vw - 24px); }
.pjb-chip span { overflow: hidden; text-overflow: ellipsis; }
.pjb-chip[hidden] { display: none; }
.pjb-chip i { width: 10px; height: 10px; background: var(--chip, #59c3ff); clip-path: polygon(0 0, 100% 50%, 0 100%); }
.pjb-chip button { width: 30px; height: 30px; font-size: 18px !important; line-height: 1; color: #cfeaff !important; background: rgba(255, 255, 255, 0.07) !important; clip-path: var(--oct); --cut: 7px; }
@media (max-width: 640px) { .pjb-chip { top: max(60px, calc(env(safe-area-inset-top) + 56px)); } }
`;

export function makeJobsBoard({ W, walls, input = null, jobs, guide, asking = () => false, captains = () => null }) {
  if (!document.getElementById('pjb-css')) { const st = document.createElement('style'); st.id = 'pjb-css'; st.textContent = CSS; document.head.appendChild(st); }
  // the boards in the station: the big one (the 'station' jobs board piece, its first: both its faces) and its small
  // copies (each 'pair' piece: its upper screen), and the room each hangs in
  const all = piecesOf(W.R).filter((x) => x.piece === 'jobs'), found = all.filter((x) => x.variant === 'station' || x.variant === 'pair');
  const pc = found.find((x) => x.variant === 'station') || found[0];
  // (the big captains' board: both its faces)
  const hangs = all.filter((x) => x.variant === 'hang');
  const spotOf = (id) => (jobs && jobs.spots || []).find((s) => s.job.id === id);
  // (each job's name is its own, as its sign in the station says it: the jobs' data, src/jobs/*.js)
  const rows = STATION_JOBS.filter((r) => spotOf(r.id)).map((r) => ({ ...r, name: spotOf(r.id).job.sign || r.name }));
  // (the captains hiring, in their board's own order: the crew's colour, the captain, the job in the board's words)
  const caps = HIRING.map(([crew, job, pay]) => { const c = CAPTAIN_ROWS.find((r) => r.crew === crew); return c ? { ...c, colour: CREWS[crew][2], line: job[0] + job.slice(1).toLowerCase(), pay } : null; }).filter(Boolean);
  const rowOf = (id) => rows.find((r) => r.id === id) || caps.find((r) => r.id === id) || null;
  let picked = null, near = false, open = false;
  const api = { rows, captains: caps, hiring: HIRING_AT, get picked() { return picked; }, get near() { return near; }, get isOpen() { return open; }, at: null, open: () => openList(), close: () => closeList(), pick: (id) => pick(id), stop: () => stop() };
  if (!pc) { console.info('jobs board: the station has no station jobs board'); return Object.assign(api, { update() {} }); }

  // ── the board's picture: drawn on a canvas as the captains' board is drawn (kit/tex.js), a row a job ──────────────
  // (one canvas for both boards: the station's jobs on its upper half, the captains hiring on its lower half)
  const CW = 1024, CH = Math.round(CW * JOBS_SCREEN.h / JOBS_SCREEN.w);
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH * 2;
  const g = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  // (the title band, then a row a job: its name and, under it, what it is; where it is to the right)
  const TOP = 72, ROW = (CH - TOP - 18) / rows.length;
  api.layout = { CH, TOP, ROW, first: TOP + 6 };
  const F = (px, bold = true) => (bold ? 'bold ' : '') + px + 'px "DejaVu Sans", Arial, sans-serif';
  function draw() {
    const gr = g.createLinearGradient(0, 0, 0, CH); gr.addColorStop(0, '#163f5a'); gr.addColorStop(1, '#0d2638'); g.fillStyle = gr; g.fillRect(0, 0, CW, CH);
    g.strokeStyle = '#59c3ff'; g.lineWidth = 5; g.strokeRect(8, 8, CW - 16, CH - 16);
    g.textBaseline = 'middle';
    g.fillStyle = '#ffffff'; g.font = F(46); g.textAlign = 'left'; g.fillText('STATION JOBS', 36, 42);
    g.fillStyle = '#9fd8ff'; g.font = F(22, false); g.textAlign = 'right'; g.fillText('PICK ONE: A LINE LEADS THE WAY', CW - 36, 46);
    g.fillStyle = 'rgba(89,195,255,0.5)'; g.fillRect(30, TOP - 2, CW - 60, 3);
    rows.forEach((r, i) => {
      const y = TOP + 6 + i * ROW, on = picked === r.id;
      g.fillStyle = on ? r.colour + '3a' : i % 2 ? 'rgba(89,195,255,0.06)' : 'rgba(89,195,255,0.12)'; g.fillRect(30, y, CW - 60, ROW - 4);
      if (on) { g.strokeStyle = r.colour; g.lineWidth = 3; g.strokeRect(28.5, y - 2, CW - 57, ROW); }
      g.fillStyle = r.colour; g.fillRect(42, y + 6, 12, ROW - 16);
      g.textAlign = 'left'; g.fillStyle = r.colour; g.font = F(26); g.fillText(r.name.toUpperCase(), 64, y + ROW * 0.31);
      g.fillStyle = '#cfeaff'; g.font = F(21, false); g.fillText(r.line, 64, y + ROW * 0.74);
      g.textAlign = 'right'; g.fillStyle = on ? '#ffffff' : '#ffe3a0'; g.font = F(23); g.fillText((on ? '\u25B8 ' : '') + r.place.toUpperCase(), CW - 48, y + ROW * 0.5);
    });
    // (the captains' board, the kit's own picture, the row of a captain picked lit)
    const cap = caps.find((c) => c.id === picked);
    g.save(); g.translate(0, CH); g.scale(CW / HIRING_AT.w, CH / HIRING_AT.h); captainsBoard(g, cap ? cap.crew : null); g.restore();
    tex.needsUpdate = true;
  }
  draw();
  // (the picture on every screen, just over the pieces' dark screens: one material; each room's screens one mesh in
  // that room's own group, drawn with it. Each screen also leaves a marker of its own, placed and turned as the screen
  // is and named for the rigs to find: the big board's 'station jobs board', a small copy's 'station jobs board, small')
  // (drawn a hair toward the camera: the captains' picture lies a millimetre over the kit's own)
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(0.86, 0.86, 0.86), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const boards = [], faces = [], byZone = new Map();
  for (const B of [pc, ...found.filter((x) => x !== pc && x.variant === 'pair'), ...hangs]) {
    const small = B.variant === 'pair', hang = B.variant === 'hang', S = small ? JOBS_PAIR : JOBS_SCREEN;
    const zone = (W.room && W.room(B.room)) || W.zoneAt(new THREE.Vector3().setFromMatrixPosition(B.M)), holder = zone ? zone.group : W.scene;
    const mid = new THREE.Vector3().setFromMatrixPosition(B.M), out = new THREE.Vector3(0, 0, 1).transformDirection(B.M);
    // (the spot to stand: on the floor under the big board's middle; in front of a small copy, out from its wall. The
    // big captains' board has none of its own: it hangs beside the station's, whose prompt is up under both)
    let board = null;
    if (!hang) {
      const at = small ? walls.snap(mid.x + out.x * BOARD.stand, 0.4, mid.z + out.z * BOARD.stand, 1.2) : walls.snap(mid.x, 0.4, mid.z, 3);
      board = { small, room: B.room, at: at || new THREE.Vector3(mid.x, 0, mid.z), near: small ? BOARD.nearSmall : BOARD.near, zone };
      boards.push(board);
    }
    // (its screens: [which way it faces, how high over the piece's middle, whose list]: a big board's two faces; a
    // small pair's two screens, the station's jobs over the captains hiring)
    const kind = hang ? 'captains' : 'jobs', screens = small ? [[1, S.up, 'jobs'], [1, -S.up, 'captains']] : [[1, 0, kind], [-1, 0, kind]];
    for (const [s, y, list] of screens) {
      const local = new THREE.Matrix4().makeRotationY(s > 0 ? 0 : Math.PI).setPosition(0, y, s * S.z + (small ? 0.0015 : 0));
      const F = { board, small, kind: list, w: S.w, h: S.h, world: B.M.clone().multiply(local), holder };
      F.inv = F.world.clone().invert();
      faces.push(F); if (!byZone.has(holder)) byZone.set(holder, []); byZone.get(holder).push(F);
    }
  }
  for (const [holder, list] of byZone) {
    holder.updateMatrixWorld(true);
    const toHolder = new THREE.Matrix4().copy(holder.matrixWorld).invert(), pos = [], uv = [], ix = [], v = new THREE.Vector3();
    for (const F of list) {
      const k = pos.length / 3, m = new THREE.Matrix4().multiplyMatrices(toHolder, F.world);
      // (its own half of the picture, a quarter of a pixel in from the line between the two)
      const v0 = F.kind === 'captains' ? 0 : 0.5, e = 0.25 / (CH * 2);
      for (const [a, b] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { v.set((a - 0.5) * F.w, (b - 0.5) * F.h, 0).applyMatrix4(m); pos.push(v.x, v.y, v.z); uv.push(a, v0 + e + b * (0.5 - 2 * e)); }
      ix.push(k, k + 1, k + 2, k, k + 2, k + 3);
      const mark = new THREE.Object3D(); mark.name = (F.kind === 'captains' ? 'captains board' : 'station jobs board') + (F.small ? ', small' : ''); mark.userData.size = [F.w, F.h];
      mark.matrixAutoUpdate = false; mark.matrix.copy(m); mark.matrixWorldNeedsUpdate = true; holder.add(mark);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(ix);
    g.computeBoundingSphere(); g.computeBoundingBox();
    const mesh = new THREE.Mesh(g, mat); mesh.name = 'station jobs boards'; mesh.matrixAutoUpdate = false; mesh.userData.faces = list;
    holder.add(mesh);
    if (input && input.addTarget) input.addTarget(mesh, { jobsBoard: true, faces: list });
  }
  const under = boards[0].at;
  api.at = under; api.boards = boards; api.faces = faces;
  // a click or a tap on a board: the screen it landed on (none: only near one), its row there (the title: -1)
  const _p = new THREE.Vector3(), _dir = new THREE.Vector3();
  const faceAt = (hit) => (hit.near ? null : (hit.data.faces || []).find((F) => { _p.copy(hit.point).applyMatrix4(F.inv); return Math.abs(_p.z) < 0.03 && Math.abs(_p.x) <= F.w / 2 + 0.01 && Math.abs(_p.y) <= F.h / 2 + 0.01; }) || null);
  const rowAt = (F, point) => {
    _p.copy(point).applyMatrix4(F.inv);
    const t = (F.h / 2 - _p.y) / F.h;        // (0 at the screen's top, 1 at its foot)
    if (F.kind === 'captains') { const u = t * HIRING_AT.h, i = Math.floor((u - HIRING_AT.first) / HIRING_AT.row); return u < HIRING_AT.title ? -1 : i >= 0 && i < caps.length ? i : null; }
    const v = t * CH;                        // (canvas pixels from the top; the same on every screen)
    const i = Math.floor((v - TOP - 6) / ROW);
    return v < TOP ? -1 : i >= 0 && i < rows.length ? i : null;
  };
  // (how tall a row is on the screen where it was hit, in the page's pixels)
  const _up = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
  const rowPx = (F, point) => {
    _up.setFromMatrixColumn(F.world, 1).normalize().multiplyScalar(F.h * (F.kind === 'captains' ? HIRING_AT.row / HIRING_AT.h : ROW / CH) / 2);
    _a.copy(point).add(_up).project(W.camera); _b.copy(point).sub(_up).project(W.camera);
    return Math.abs(_a.y - _b.y) / 2 * innerHeight;
  };
  // (a screen that can be seen from the camera: its room drawn, and no wall between the camera and the point)
  const inSight = (F, point) => {
    if (F.holder.visible === false) return false;
    const d = _dir.copy(point).sub(W.camera.position).length(); if (d < 0.05) return true;
    return walls.reach(W.camera.position, _dir.multiplyScalar(1 / d), d) >= d - 0.35;
  };
  if (input && input.onPick) input.onPick((pk) => {
    if (!pk.hit || !pk.hit.data || !pk.hit.data.jobsBoard || !playing || open) return;
    const F = faceAt(pk.hit);
    // (beside a screen, not on it: the list, when the player is at a board; never a row guessed at)
    if (!F) { if (near) openFromTap(); return; }
    if (!inSight(F, pk.hit.point)) return;
    const i = rowAt(F, pk.hit.point), on = F.kind === 'captains' ? caps : rows;
    // (a captain with no mission to pick: their line is to read, and a click on it does nothing)
    if (i === -1 || (i != null && rowPx(F, pk.hit.point) < (pk.touch ? BOARD.finger : BOARD.pointer))) openFromTap(); else if (i != null && on[i].pick !== false) pick(on[i].id);
  });

  // ── the prompt near the board, and the list ──────────────────────────────────────────────────────────────────
  const prompt = document.createElement('div');
  prompt.className = 'pjb-prompt'; prompt.hidden = true;
  prompt.innerHTML = '<div class="pjb-pw"><b>Jobs and captains</b><small>Pick one, and a line on the floor leads you there</small></div><button type="button" class="pjb-open">Pick<kbd>E</kbd></button>';
  document.body.appendChild(prompt);
  prompt.querySelector('.pjb-open').addEventListener('click', () => openList());
  const panel = document.createElement('div');
  panel.className = 'pjb'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Station jobs and captains hiring'); panel.tabIndex = -1;
  panel.innerHTML = '<div class="pjb-head"><b>STATION JOBS</b><small>Work aboard the station</small><button type="button" class="pjb-x" aria-label="Close (Esc)">&times;</button></div><div class="pjb-rows"></div>'
    + '<div class="pjb-sub"><b>CAPTAINS HIRING</b><small>Crew for their ships</small></div><div class="pjb-rows pjb-caps"></div>'
    + '<div class="pjb-foot"><span>Pick one: a glowing line on the floor leads you there.</span><button type="button" class="pjb-stop" hidden>No line</button></div>';
  document.body.appendChild(panel);
  const list = panel.querySelector('.pjb-rows'), capList = panel.querySelector('.pjb-caps');
  // (following a line: a small chip at the top says to which job, in its colour, with an X to take the line away)
  const chip = document.createElement('div');
  chip.className = 'pjb-chip'; chip.hidden = true;
  chip.innerHTML = '<i></i><span></span><button type="button" aria-label="Stop following the line">&times;</button>';
  document.body.appendChild(chip);
  chip.querySelector('button').addEventListener('click', () => stop());
  rows.forEach((r, i) => {
    const line = document.createElement('div'); line.className = 'pjb-line';
    line.innerHTML = `<kbd class="pjb-key">${i + 1}</kbd>`;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pjb-row'; b.dataset.job = r.id;
    b.style.setProperty('--job', r.colour);
    b.innerHTML = `<i style="background:${r.colour}"></i><span><b style="color:${r.colour}">${r.name}</b><small>${r.line}</small></span><em>${r.place}</em>`;
    b.addEventListener('click', () => { pick(r.id); closeList(); });
    line.appendChild(b); list.appendChild(line);
  });
  // (the captains under them, as their board has them: the number keys go on from the jobs'; a captain with no
  // mission to pick is a line to read)
  const keyed = [...rows, ...caps.filter((c) => c.pick)];
  caps.forEach((r) => {
    const line = document.createElement('div'); line.className = 'pjb-line';
    line.innerHTML = `<kbd class="pjb-key"${r.pick ? '' : ' style="visibility:hidden"'}>${r.pick ? keyed.indexOf(r) + 1 : ''}</kbd>`;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pjb-row' + (r.pick ? '' : ' is-off'); b.dataset.job = r.id; b.disabled = !r.pick;
    b.style.setProperty('--job', r.colour);
    b.innerHTML = `<i style="background:${r.colour}"></i><span><b style="color:${r.colour}">${r.name}</b><small>${r.line}</small></span><em>${r.pay ? r.pay + ' cr' : 'In repair'}</em>`;
    if (r.pick) b.addEventListener('click', () => { pick(r.id); closeList(); });
    line.appendChild(b); capList.appendChild(line);
  });
  panel.querySelector('.pjb-x').addEventListener('click', () => closeList());
  panel.querySelector('.pjb-stop').addEventListener('click', () => { stop(); closeList(); });
  function mark() {
    for (const b of panel.querySelectorAll('.pjb-row')) b.classList.toggle('is-on', b.dataset.job === picked);
    panel.querySelector('.pjb-stop').hidden = !picked;
    const r = rowOf(picked);
    if (r) { chip.querySelector('span').textContent = r.name; chip.style.setProperty('--chip', r.colour); }
    draw();
  }
  // (the list opened by a tap on a board comes up under the finger, and the browser then sends that same tap's click
  // to whatever is there now: a row of the list, which was picked without being meant (a phone, the list of ten rows
  // tall enough to lie under any tap on a small board). For a moment after such an opening the list takes no click.)
  let tapOpened = -1e9;
  function openFromTap() { if (open || !playing) return; tapOpened = performance.now(); openList(); }
  panel.addEventListener('click', (e) => { if (performance.now() - tapOpened < BOARD.ghost) { e.stopPropagation(); e.preventDefault(); } }, true);
  let wasInput = true;
  function openList() {
    if (open || !playing) return;
    open = true; panel.hidden = false; prompt.hidden = true; mark();
    if (input) { wasInput = input.enabled; input.enabled = false; }
    // (the keyboard's focus on the panel, not a row: a row lit by it read as a job already picked)
    if (!matchMedia('(pointer: coarse)').matches) (panel.querySelector('.pjb-row.is-on') || panel).focus({ preventScroll: true });
  }
  function closeList() {
    if (!open) return;
    open = false; panel.hidden = true;
    if (input) input.enabled = wasInput;
  }
  // a job picked: lit on the board and in the list, and the line to it; the same one again: the line off. A captain
  // picked: the same, the line to wherever that captain is and after them as they walk (boardpick.js targetOf); the
  // people are told who the player is being led to (people.js `seek`: that captain is kept about, and makes the offer
  // when the player walks up)
  let player = null, playing = false, sought = 0;
  const captainAt = (id) => { const c = captains(); return c ? c.at(id) : null; };
  const seek = (id) => { const c = captains(); if (c && c.seek) c.seek(id); };
  function pick(id) {
    const t = targetOf(id, { spotOf, captainAt, rows, captains: caps }); if (!t) return false;
    if (picked === id) { stop(); return true; }
    picked = id; sought = 0; seek(t.kind === 'captain' ? id : null); mark();
    guide.to(t.pos, { near: t.near, label: id, colour: t.colour, follow: t.follow || null }, player ? player.pos : null);
    return true;
  }
  function stop() { picked = null; sought = 0; seek(null); guide.clear(); mark(); }
  addEventListener('keydown', (e) => {
    if (!playing || (jobs && jobs.panel)) return;
    if (open) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeList(); return; }
      const n = +e.key; if (n >= 1 && n <= keyed.length) { e.preventDefault(); pick(keyed[n - 1].id); closeList(); }
      return;
    }
    // (E is the board's only while its prompt is the one up: never a captain's question's too)
    if (near && !prompt.hidden && (e.key === 'e' || e.key === 'E') && !(jobs && jobs.near)) { e.preventDefault(); e.stopImmediatePropagation(); openList(); }
  }, true);

  const _d = new THREE.Vector3();
  api.update = (dt, P, isPlaying = true) => {
    playing = isPlaying && !!P; player = P;
    if (!playing) { if (open) closeList(); prompt.hidden = true; chip.hidden = true; near = false; return; }
    // (the line done with: the board's pick let go when the line is gone, as they got there, or is another's now. A
    // captain walked up to keeps the first word for a few seconds more, till their offer is made: people.js)
    if (picked && guide.active !== picked) { if (caps.some((c) => c.id === picked)) sought = BOARD.sought; picked = null; mark(); }
    if (sought > 0) { sought -= dt; if (sought <= 0) seek(null); }
    chip.hidden = !picked || open;
    // near a board (the big one, or a small copy), looking its way, no job's own prompt up, no panel open: the prompt
    W.camera.getWorldDirection(_d); _d.y = 0; _d.normalize();
    near = false;
    if (!(jobs && (jobs.near || jobs.panel))) for (const B of boards) {
      const dx = B.at.x - P.pos.x, dz = B.at.z - P.pos.z, d = Math.hypot(dx, dz);
      if (d >= B.near || Math.abs(P.pos.y - B.at.y) >= 1.5) continue;
      if (d < 1.5 || (_d.x * dx + _d.z * dz) / (d || 1) > BOARD.facing) { near = true; break; }
    }
    // (one prompt at a time: a captain's question up, the board's waits)
    prompt.hidden = !near || open || !!asking();
    // (a job picked: the prompt says which, and that another can be picked)
    const pr = picked && rowOf(picked);
    const sub = pr ? 'Follow the ' + (pr.hue ? pr.hue + ' ' : '') + 'line to ' + pr.name + '.' : 'Pick one, and a line on the floor leads you there';
    if (prompt.dataset.sub !== sub) {
      prompt.dataset.sub = sub; prompt.querySelector('small').textContent = sub;
      prompt.querySelector('.pjb-open').firstChild.textContent = pr ? 'Change' : 'Pick';
    }
  };
  return api;
}
