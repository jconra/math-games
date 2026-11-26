// THE ELECTRIC PICTURE ON A PAGE'S CANVAS: a small three.js renderer drawing the electric picture's material
// (src/music/electric.js) on one quad that fills the canvas. The Music Lab's screens use it; a wall screen in the game
// does not need it (it puts the material straight on its own panel). Loaded only when the picture is first shown, so a
// page that never shows it never loads three for it.
//
//   const V = electricView(canvas)   throws if there is no WebGL (the screen then shows the Notes picture)
//   V.draw(f, w, h, time, shader?)   one picture from the tap frame f at w x h of the canvas's own pixels; shader: which
//                                    picture, 'electric' (the first) or 'hex' (src/music/hex.js), each material made the
//                                    first time it is drawn
//   V.ok()                           false once the context is lost (the screen goes to the Notes picture)
//   V.cost(n)                        the rigs: the mean ms of n pictures, each read back so the drawing is really done
//   V.dispose()
import * as THREE from 'three';
import { electricMaterial, electricUniforms } from './electric.js';
import { hexMaterial } from './hex.js';

const MAKERS = { electric: electricMaterial, hex: hexMaterial };

export function electricView(canvas) {
  // (asked first on a spare canvas, so a browser with no WebGL is told plainly and three never complains on the screen)
  const probe = document.createElement('canvas'), pg = probe.getContext('webgl2') || probe.getContext('webgl');
  if (!pg) throw new Error('no WebGL here');
  const lose = pg.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  let lost = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });
  // (a shader that will not build on this device: as lost, the screen shows the Notes picture)
  renderer.debug.onShaderError = (gl, prog, vs, fs) => { lost = true; console.warn('music: the electric picture\'s shader did not build:', gl.getShaderInfoLog(fs)); };
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mats = {}, matOf = (k) => mats[k] || (mats[k] = (MAKERS[k] || MAKERS.electric)(THREE));
  const mat = matOf('electric'), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false; scene.add(quad);
  let U = mat.userData.state;
  let W = 0, H = 0, last = null, lastShader = 'electric';
  const V = {
    renderer, get material() { return quad.material; },
    ok: () => !lost,
    draw(f, w, h, time, shader = 'electric') {
      if (lost) return;
      const m = matOf(MAKERS[shader] ? shader : 'electric');
      if (quad.material !== m) { quad.material = m; U = m.userData.state; }
      lastShader = shader;
      if (w !== W || h !== H) { renderer.setSize(w, h, false); W = w; H = h; }
      electricUniforms(f, U, { time, aspect: w / h, px: 1 / h });
      last = f;
      renderer.render(scene, cam);
    },
    cost(n = 60) {
      const gl = renderer.getContext(), px = new Uint8Array(4);
      if (!last) return null;
      V.draw(last, W, H, U.uTime, lastShader); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const t0 = performance.now();
      for (let i = 0; i < n; i++) { V.draw(last, W, H, U.uTime + i / 60, lastShader); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
      return { ms: (performance.now() - t0) / n, w: W, h: H };
    },
    dispose() { quad.geometry.dispose(); for (const k in mats) mats[k].dispose(); renderer.dispose(); },
  };
  return V;
}
