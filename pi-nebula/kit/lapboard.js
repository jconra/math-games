// THE BEST LAP'S BOARD IN CARGO, THE PART THAT IS WRITTEN ON (2026-11-23, the game's maker, LAP1-2, B: "Something to
// show for it in Cargo: a small board by the forklift's bay with the best lap on it and whose it is."). The board itself
// (its dark panel on the south wall behind the forklift's bay, its frame, BEST LAP across its top, its row of chequers)
// is part of Cargo's hall (kit/store.js lapBoard; where: kit/places-plan.js LAP.board). The time and the name change, so
// they are drawn apart: one small picture on a flat panel just in front of the board's face, dark with light letters as
// the station's other signs are (src/jobs/index.js: the same off-white and orange), lit by itself so it reads from the
// bay whatever the room's light. The game writes the best official lap of the crew members on this device and whose it
// is (src/cargolap.js, src/lapbest.js); the Kit Lab's Cargo shows it as it is before anyone has beaten Cargo's loader.
//   const B = makeLapBoard()         B.mesh (added to Cargo's room: it stands in the room's own frame)
//   B.set({ name, time, crew })      the lap written on it (time: seconds; crew: one of the crew members holds it)
//   B.shown                          what is written on it now
import * as THREE from 'three';
import { LAP, STORE } from './places-plan.js';
import { WALL_FACE } from './grid.js';

// where the board's face is: on the south wall's panels (their face WALL_FACE and 2 cm in from the wall's line), the
// board LAP.board.out proud of them, the written panel a few millimetres proud of that
export const BOARD_FACE = { z: STORE.z1 - WALL_FACE - 0.02 - LAP.board.out, gap: 0.004 };
const PX = 512;      // (the picture's width; its height by the panel's shape)

export function makeLapBoard() {
  const [w, h, up] = LAP.board.face;
  const cv = document.createElement('canvas'); cv.width = PX; cv.height = Math.round(PX * h / w);
  const g = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  // (it faces north, into the room: a flat panel turned half round)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateY(Math.PI), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  mesh.position.set(LAP.board.x, STORE.floor + LAP.board.y + up, BOARD_FACE.z - BOARD_FACE.gap);
  mesh.name = 'the best lap, written on its board';
  const B = { mesh, shown: null };
  B.set = ({ name, time, crew = false }) => {
    const W = cv.width, H = cv.height, t = time.toFixed(1), who = String(name || '').slice(0, 16);
    g.fillStyle = '#0a0e14'; g.fillRect(0, 0, W, H);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    // the time, big; "s" after it, smaller; whose it is under it
    g.font = '800 118px "Segoe UI", system-ui, "DejaVu Sans", Arial, sans-serif';
    const tw = g.measureText(t).width; g.font = '700 56px "Segoe UI", system-ui, "DejaVu Sans", Arial, sans-serif'; const sw = g.measureText(' s').width;
    const x0 = (W - tw - sw) / 2;
    g.textAlign = 'left'; g.fillStyle = '#fff3e6'; g.font = '800 118px "Segoe UI", system-ui, "DejaVu Sans", Arial, sans-serif'; g.fillText(t, x0, H * 0.6);
    g.fillStyle = '#c9d2db'; g.font = '700 56px "Segoe UI", system-ui, "DejaVu Sans", Arial, sans-serif'; g.fillText(' s', x0 + tw, H * 0.6);
    g.textAlign = 'center'; g.fillStyle = crew ? '#ffb46b' : '#9fb4c8'; g.font = '700 50px "Segoe UI", system-ui, "DejaVu Sans", Arial, sans-serif';
    g.fillText(who, W / 2, H * 0.92, W - 36);
    tex.needsUpdate = true;
    B.shown = { name: who, time: t, crew: !!crew };
  };
  B.dispose = () => { tex.dispose(); mesh.geometry.dispose(); mesh.material.dispose(); };
  return B;
}
