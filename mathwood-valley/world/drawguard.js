// THE DRAW GUARD: a thing whose shader the graphics card hasn't finished building is left out of the frame until it has.
//
// three.js builds a material's shader the first time something is drawn with it, and that frame waits for the build.
// In Chrome on Windows (Direct3D 11 underneath) one build takes 0.1 to 3 s, so everything seen for the first time froze
// the game that long: after RIDE OUT it added up to about 8 s of freezes in the first 17 (a recording from the game's
// maker, 2026-11-03). With this, a thing whose shader isn't built is skipped while three's compileAsync builds it in the
// background (the browser's KHR_parallel_shader_compile: the page goes on while the card works), and it comes in a
// moment later, a frame or a few.
//
// Only the world's own scene is guarded: the passes and pictures that draw scenes of their own are left alone, and so are
// the shadows' depth shaders (small, built by the draw). A draw that needs every part at once (a picture taken of a room
// for its windows, world/objects/codebuildings.js) raises `off` around it. Something held more than HOLD_MS is drawn
// anyway, so nothing can stay missing.
//
//   const G = guardDraws(renderer, { scene, camera })   // once (a second call gives back the same guard)
//   G.flush()           // after each frame's drawing: what was held back starts building
//   G.off++ / G.off--   // around a draw that must have every part
//   G.state()           // { held: draws skipped so far, building: batches in the background, built: things let in }

const HOLD_MS = 8000;

export function guardDraws(renderer, { scene, camera }) {
  if (renderer.__drawGuard) return renderer.__drawGuard;
  const props = renderer.properties, draw = renderer.renderBufferDirect;
  const asked = new WeakMap();   // material -> when it was first held back
  let held = [], skipped = 0, building = 0, built = 0;
  const G = { off: 0, on: true };
  renderer.renderBufferDirect = function (cam, sc, geometry, material, object, group) {
    if (sc === scene && G.on && G.off === 0) {
      const pr = props.get(material).currentProgram;
      if (!pr || !pr.isReady()) {
        const t = asked.get(material), now = performance.now();
        if (t === undefined) { asked.set(material, now); if (!pr) held.push(object); }
        if (t === undefined || now - t < HOLD_MS) { skipped++; return; }
      }
    }
    return draw.call(this, cam, sc, geometry, material, object, group);
  };
  G.flush = () => {
    if (!held.length) return;
    const list = held; held = [];
    // (a stand-in root over the held things: their materials built for the scene's lights. Its lights part is empty, so a
    // lamp inside one of them isn't counted twice: it is in the scene already)
    const root = { traverse: (f) => { for (const o of list) o.traverse(f); }, traverseVisible: () => {} };
    building++;
    const done = () => { building--; built += list.length; };
    try { renderer.compileAsync(root, camera, scene).then(done, done); } catch (e) { done(); console.warn('draw guard: a shader could not be built ahead', e); }
  };
  G.state = () => ({ held: skipped, building, built });
  renderer.__drawGuard = G;
  return G;
}
