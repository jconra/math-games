// INPUT: the keyboard, the mouse and touch, read into one plain shape that the player and the camera use each frame.
//
//   import { makeInput } from './input.js';
//   const I = makeInput(canvas, { camera })
//
// The code itself lives in shared/input.js now, as it was here (the space game walks with the same keys and the same
// thumb stick), so a fix is made once and reaches both games. What it gives, and how touch works, is written at the
// top of that file. Nothing about it changed for this game: the same call, the same cream thumb stick.
export * from '../../shared/input.js';
