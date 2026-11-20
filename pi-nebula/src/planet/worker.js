// THE GROUND MADE AWAY FROM THE PAGE (a worker): the same src/planet/land.js, so the page keeps drawing while a
// planet is made (in the game, while the jump's cards are answered). Asked { seed, kind }, it answers with the land's
// numbers (src/planet/land.js finishLand turns them back into a land), its arrays moved over, not copied.
import { makeLand } from './land.js';

self.onmessage = (e) => {
  const { id, seed, kind } = e.data || {};
  try {
    const d = makeLand(seed, { kind }).data();
    self.postMessage({ id, land: d }, [d.H.buffer, d.NM.buffer, d.EX.buffer]);
  } catch (err) {
    self.postMessage({ id, error: String(err && err.stack || err) });
  }
};
