// THE STATION'S JOBS BOARD, hung beside the captains' board in the terminal (kit/furniture.js jobs 'station'). The game's
// maker (2026-11-17): "We do have other jobs. Maybe we need another jobs board that lists local station jobs? I think we
// need the ability to click on them and get the glowing lines in the floor or colored lights to follow or something that
// can take us to the job we selected."
// The board lists the station's own jobs, each with a line on what it is and where; the one picked is lit on it. Pick
// one by tapping or clicking its row on the board itself, or walk up to the board (a prompt comes up: E, or its button)
// and pick from the list that opens on the screen; a glowing line on the floor then leads from the player to that job
// (guide.js), and fades as they get there or when another is picked. The list has the board's own look.
//
//   const board = makeJobsBoard({ W, walls, input, jobs, guide, asking })   asking(): a question already up (a captain's)
//   board.update(dt, P, playing)   each frame: the prompt near the board, the board's picture when the pick changes
//   board.open() / board.close() / board.pick(id) / board.stop()     (the rigs: GAME.board)
//   board.rows, board.picked, board.near, board.isOpen
import * as THREE from 'three';
import { piecesOf } from './people.js';
import { JOBS_SCREEN } from '../kit/furniture.js';

// THE JOBS LISTED, in the board's order (the station's own: src/jobs/), each its colour, what it is and where it is
export const STATION_JOBS = [
  { id: 'galley', name: 'Galley kitchen', line: 'Cook up the diners\' orders', place: 'Terminal', colour: '#ffb347' },
  { id: 'medical', name: 'Triage desk', line: 'Help the patients who come in', place: 'Medical', colour: '#ff6a5a' },
  { id: 'smelter', name: 'Smelter controls', line: 'Work out what a haul of ore pays', place: 'Smelter', colour: '#ff8a3a' },
  { id: 'crane', name: 'Crane operator', line: 'Check the crane\'s moves', place: 'Control room', colour: '#ffd35a' },
  { id: 'dock', name: 'Docking bridge', line: 'Build the bridge out to a ship', place: 'Dock', colour: '#59c3ff' },
  { id: 'arena', name: 'Mathball', line: 'Throw number balls into the right goals', place: 'Arena', colour: '#b98cff' },
];
// near the board: how far from the spot under it the prompt comes up (m), and how much the view must be turned toward
// it (the dot of the camera's way and the way to the board, level)
export const BOARD = { near: 6.5, facing: 0.25 };

const CSS = `
.pjb-prompt, .pjb { --ink: #eef1f4; --dim: #a7b0ba; --line: rgba(196, 220, 240, 0.36); --cyan: #59c3ff; --accent: #ff8f2e; --accent-ink: #1c1205; --cut: 12px;
  --oct: polygon(var(--cut) 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, var(--cut) 100%, 0 calc(100% - var(--cut)), 0 var(--cut));
  font: 400 16px/1.35 "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif; color: var(--ink); -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
.pjb-prompt *, .pjb * { box-sizing: border-box; }
.pjb-prompt button, .pjb button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }
.pjb-prompt { position: fixed; left: 50%; bottom: max(26px, env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 15; display: flex; align-items: center; gap: 12px;
  padding: 8px 8px 8px 18px; background: rgba(15, 19, 25, 0.9); box-shadow: inset 0 0 0 1.5px rgba(89, 195, 255, 0.55); clip-path: var(--oct); max-width: calc(100vw - 32px); }
.pjb-prompt[hidden], .pjb[hidden] { display: none; }
.pjb-prompt .pjb-pw { display: flex; flex-direction: column; min-width: 0; }
.pjb-prompt .pjb-pw b { font-size: 14px; letter-spacing: 0.1em; text-transform: uppercase; color: #bfe6ff; }
.pjb-prompt .pjb-pw small { font-size: 13px; color: var(--dim); }
.pjb-open { flex: none; height: 44px; padding: 0 18px; font-size: 15px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #06202e !important; background: var(--cyan) !important; clip-path: var(--oct); --cut: 9px; }
.pjb kbd, .pjb-prompt kbd { font: 700 10px/1 inherit; font-family: inherit; padding: 3px 5px; margin-left: 8px; border-radius: 3px; background: rgba(0, 0, 0, 0.18); vertical-align: 2px; }
@media (hover: none) and (pointer: coarse) { .pjb kbd, .pjb-prompt kbd { display: none; } }
.pjb { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 20; width: min(560px, calc(100vw - 24px)); max-height: calc(100vh - 24px); overflow: auto;
  padding: 16px 16px 14px; background: linear-gradient(#163f5a, #0d2638); box-shadow: inset 0 0 0 3px var(--cyan); clip-path: var(--oct); }
.pjb-head { display: flex; align-items: baseline; gap: 10px; margin: 0 2px 10px; padding-bottom: 8px; border-bottom: 2px solid rgba(89, 195, 255, 0.5); }
.pjb-head b { font-size: 24px; font-weight: 800; letter-spacing: 0.04em; color: #fff; }
.pjb-head small { flex: 1; font-size: 13px; color: #9fd8ff; letter-spacing: 0.06em; text-transform: uppercase; }
.pjb-x { flex: none; width: 40px; height: 40px; margin: -6px -6px 0 0; font-size: 22px !important; line-height: 1; color: #cfeaff !important; background: rgba(255, 255, 255, 0.06) !important; clip-path: var(--oct); --cut: 8px; }
.pjb-row { display: grid; grid-template-columns: 12px 1fr auto; align-items: center; column-gap: 12px; width: 100%; min-height: 56px; padding: 8px 12px 8px 10px; margin-top: 6px; text-align: left;
  background: rgba(89, 195, 255, 0.1) !important; box-shadow: inset 0 0 0 1px rgba(89, 195, 255, 0.18); clip-path: var(--oct); --cut: 8px; }
.pjb-row:nth-child(even) { background: rgba(89, 195, 255, 0.05) !important; }
.pjb-row:hover, .pjb-row:focus-visible { background: rgba(89, 195, 255, 0.22) !important; outline: none; }
.pjb-row i { width: 12px; align-self: stretch; clip-path: polygon(0 0, 100% 3px, 100% calc(100% - 3px), 0 100%); }
.pjb-row span { display: flex; flex-direction: column; min-width: 0; }
.pjb-row b { font-size: 16px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; }
.pjb-row small { font-size: 14px; color: #cfeaff; }
.pjb-row em { font-style: normal; font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #ffe3a0; text-align: right; }
.pjb-row.is-on { background: rgba(89, 195, 255, 0.32) !important; box-shadow: inset 0 0 0 2px var(--cyan); }
.pjb-row.is-on em::after { content: ' \\25B8 line on'; color: #8ff0ff; }
.pjb-foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 12px; font-size: 13px; color: #9fd8ff; }
.pjb-stop { height: 36px; padding: 0 14px; font-size: 13px !important; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #cfeaff !important; background: rgba(255, 255, 255, 0.07) !important; clip-path: var(--oct); --cut: 8px; }
.pjb-stop[hidden] { display: none; }
@media (max-width: 640px) { .pjb { top: auto; bottom: max(10px, env(safe-area-inset-bottom)); transform: translateX(-50%); padding: 12px 12px 10px; } .pjb-head b { font-size: 20px; } .pjb-row { min-height: 52px; } .pjb-row small { font-size: 13px; } }
`;

export function makeJobsBoard({ W, walls, input = null, jobs, guide, asking = () => false }) {
  if (!document.getElementById('pjb-css')) { const st = document.createElement('style'); st.id = 'pjb-css'; st.textContent = CSS; document.head.appendChild(st); }
  // the board in the station: the 'station' jobs board piece (its first), and the room it hangs in
  const pc = piecesOf(W.R).find((x) => x.piece === 'jobs' && x.variant === 'station');
  const spotOf = (id) => (jobs && jobs.spots || []).find((s) => s.job.id === id);
  const rows = STATION_JOBS.filter((r) => spotOf(r.id));
  let picked = null, near = false, open = false;
  const api = { rows, get picked() { return picked; }, get near() { return near; }, get isOpen() { return open; }, at: null, open: () => openList(), close: () => closeList(), pick: (id) => pick(id), stop: () => stop() };
  if (!pc) { console.info('jobs board: the station has no station jobs board'); return Object.assign(api, { update() {} }); }

  // ── the board's picture: drawn on a canvas as the captains' board is drawn (kit/tex.js), a row a job ──────────────
  const CW = 1024, CH = Math.round(CW * JOBS_SCREEN.h / JOBS_SCREEN.w);
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
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
      g.fillStyle = on ? 'rgba(89,195,255,0.38)' : i % 2 ? 'rgba(89,195,255,0.06)' : 'rgba(89,195,255,0.12)'; g.fillRect(30, y, CW - 60, ROW - 4);
      if (on) { g.strokeStyle = '#8ff0ff'; g.lineWidth = 4; g.strokeRect(32, y + 2, CW - 64, ROW - 8); }
      g.fillStyle = r.colour; g.fillRect(38, y + 6, 12, ROW - 16);
      g.textAlign = 'left'; g.fillStyle = r.colour; g.font = F(26); g.fillText(r.name.toUpperCase(), 64, y + ROW * 0.31);
      g.fillStyle = '#cfeaff'; g.font = F(19, false); g.fillText(r.line, 64, y + ROW * 0.73);
      g.textAlign = 'right'; g.fillStyle = on ? '#8ff0ff' : '#ffe3a0'; g.font = F(23); g.fillText(on ? '\u25B8 FOLLOW THE LINE' : r.place.toUpperCase(), CW - 44, y + ROW * 0.5);
    });
    tex.needsUpdate = true;
  }
  draw();
  // (the picture on both faces, just over the piece's dark screens; in the room's own group, drawn with it)
  const zone = W.zoneAt(new THREE.Vector3().setFromMatrixPosition(pc.M)) || (W.room && W.room(pc.room));
  const holder = zone ? zone.group : W.scene;
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(0.86, 0.86, 0.86) });
  const faces = [];
  for (const s of [1, -1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(JOBS_SCREEN.w, JOBS_SCREEN.h), mat);
    const local = new THREE.Matrix4().makeRotationY(s > 0 ? 0 : Math.PI).setPosition(0, 0, s * JOBS_SCREEN.z);
    const world = pc.M.clone().multiply(local);
    holder.updateMatrixWorld(true);
    m.matrixAutoUpdate = false; m.matrix.copy(new THREE.Matrix4().copy(holder.matrixWorld).invert().multiply(world)); m.matrixWorldNeedsUpdate = true;
    m.userData.face = s; m.name = 'station jobs board';
    holder.add(m); faces.push(m);
    if (input && input.addTarget) input.addTarget(m, { jobsBoard: true });
  }
  // (the spot on the floor under the board's middle, for "near")
  const mid = new THREE.Vector3().setFromMatrixPosition(pc.M), under = walls.snap(mid.x, 0.4, mid.z, 3) || new THREE.Vector3(mid.x, 0, mid.z);
  api.at = under;
  // a click or a tap on the board: its row picked (the title: the list opened)
  const rowAt = (point) => {
    const inv = pc.M.clone().invert(), p = point.clone().applyMatrix4(inv);
    const v = (JOBS_SCREEN.h / 2 - p.y) / JOBS_SCREEN.h * CH;   // (canvas pixels from the top; the same on both faces)
    const i = Math.floor((v - TOP - 6) / ROW);
    return v < TOP ? -1 : i >= 0 && i < rows.length ? i : null;
  };
  if (input && input.onPick) input.onPick((pk) => {
    if (!pk.hit || !pk.hit.data || !pk.hit.data.jobsBoard || !playing || open) return;
    const i = rowAt(pk.hit.point);
    if (i === -1) openList(); else if (i != null) pick(rows[i].id);
  });

  // ── the prompt near the board, and the list ──────────────────────────────────────────────────────────────────
  const prompt = document.createElement('div');
  prompt.className = 'pjb-prompt'; prompt.hidden = true;
  prompt.innerHTML = '<div class="pjb-pw"><b>Station jobs</b><small>Pick one, and a line on the floor leads you there</small></div><button type="button" class="pjb-open">Pick<kbd>E</kbd></button>';
  document.body.appendChild(prompt);
  prompt.querySelector('.pjb-open').addEventListener('click', () => openList());
  const panel = document.createElement('div');
  panel.className = 'pjb'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Station jobs');
  panel.innerHTML = '<div class="pjb-head"><b>STATION JOBS</b><small>Work aboard the station</small><button type="button" class="pjb-x" aria-label="Close (Esc)">&times;</button></div><div class="pjb-rows"></div>'
    + '<div class="pjb-foot"><span>Pick a job: a glowing line on the floor leads you to it.</span><button type="button" class="pjb-stop" hidden>No line</button></div>';
  document.body.appendChild(panel);
  const list = panel.querySelector('.pjb-rows');
  rows.forEach((r, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pjb-row'; b.dataset.job = r.id;
    b.innerHTML = `<i style="background:${r.colour}"></i><span><b style="color:${r.colour}">${r.name}</b><small>${r.line}</small></span><em>${r.place}<kbd>${i + 1}</kbd></em>`;
    b.addEventListener('click', () => { pick(r.id); closeList(); });
    list.appendChild(b);
  });
  panel.querySelector('.pjb-x').addEventListener('click', () => closeList());
  panel.querySelector('.pjb-stop').addEventListener('click', () => { stop(); closeList(); });
  function mark() {
    for (const b of list.children) b.classList.toggle('is-on', b.dataset.job === picked);
    panel.querySelector('.pjb-stop').hidden = !picked;
    draw();
  }
  let wasInput = true;
  function openList() {
    if (open || !playing) return;
    open = true; panel.hidden = false; prompt.hidden = true; mark();
    if (input) { wasInput = input.enabled; input.enabled = false; }
    const first = list.querySelector('.is-on') || list.firstChild; if (first && !matchMedia('(pointer: coarse)').matches) first.focus({ preventScroll: true });
  }
  function closeList() {
    if (!open) return;
    open = false; panel.hidden = true;
    if (input) input.enabled = wasInput;
  }
  // a job picked: lit on the board and in the list, and the line to it; the same one again: the line off
  let player = null, playing = false;
  function pick(id) {
    const s = spotOf(id); if (!s) return false;
    if (picked === id) { stop(); return true; }
    picked = id; mark();
    guide.to(s.pos, { near: (s.job.near ?? 1.7) - 0.1, label: id }, player ? player.pos : null);
    return true;
  }
  function stop() { picked = null; guide.clear(); mark(); }
  addEventListener('keydown', (e) => {
    if (!playing || (jobs && jobs.panel)) return;
    if (open) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeList(); return; }
      const n = +e.key; if (n >= 1 && n <= rows.length) { e.preventDefault(); pick(rows[n - 1].id); closeList(); }
      return;
    }
    // (E is the board's only while its prompt is the one up: never a captain's question's too)
    if (near && !prompt.hidden && (e.key === 'e' || e.key === 'E') && !(jobs && jobs.near)) { e.preventDefault(); e.stopImmediatePropagation(); openList(); }
  }, true);

  const _d = new THREE.Vector3();
  api.update = (dt, P, isPlaying = true) => {
    playing = isPlaying && !!P; player = P;
    if (!playing) { if (open) closeList(); prompt.hidden = true; near = false; return; }
    // (the line done with: the board's pick let go when the line is gone, as they got there)
    if (picked && !guide.active) { picked = null; mark(); }
    // near the board, looking its way, no job's own prompt up, no panel open: the prompt
    const dx = under.x - P.pos.x, dz = under.z - P.pos.z, d = Math.hypot(dx, dz);
    W.camera.getWorldDirection(_d); _d.y = 0; _d.normalize();
    const facing = d < 1.5 || (_d.x * dx + _d.z * dz) / (d || 1) > BOARD.facing;
    near = d < BOARD.near && Math.abs(P.pos.y - under.y) < 1.5 && facing && !(jobs && (jobs.near || jobs.panel));
    // (one prompt at a time: a captain's question up, the board's waits)
    prompt.hidden = !near || open || !!asking();
    // (a job picked: the prompt says which, and that another can be picked)
    const sub = picked ? 'Following the line to ' + (rows.find((r) => r.id === picked) || {}).name + '. Pick another?' : 'Pick one, and a line on the floor leads you there';
    if (prompt.dataset.sub !== sub) { prompt.dataset.sub = sub; prompt.querySelector('small').textContent = sub; }
  };
  return api;
}
