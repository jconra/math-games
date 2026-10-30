// BUBBLE: a person's spoken line as a speech bubble over their head, placed in 3D: the point over the head is projected
// each frame, so the bubble moves with the speaker and with the camera, its tail pointing down at them. It fades with
// distance and hides when the speaker is off the screen, behind the camera or far off. It never sits in a fixed place
// on the screen (the game's maker: speech bubbles "forcing their way on my screen" were the trouble; "it should just be
// above the head of the npc in 3d space").
//
//   placeBubble(el, at, camera, { dist, avoid, below }) -> true when shown over the head, false when it can't be (hide it)
//     el      the bubble (position: absolute; left/top 0: it is moved with a transform; --tail: where its tail points)
//     at      a THREE.Vector3: the world point just over the speaker's head (changed: it is projected in place)
//     dist    metres from the player to the speaker (the fade, and hidden past BUBBLE.far)
//     avoid   page elements up top the bubble keeps out from under (the job's card, its hint line): when the head is
//             right under one the bubble sits just below it, still over the speaker, with no tail
//     below   the screen y the bubble keeps above (the help box's top), Infinity for none
//   bubbleFade(dist) -> 0..1   how strong the bubble shows at that distance (0: hidden)
//   bubbleParts(lines) -> [[...lines]]   a long two-line speech is said in two parts, one after the other
//   partAt(parts, f) -> index   the part showing at f (0..1) of the time the speech is up (by the parts' lengths)
//   BUBBLE   the dials
export const BUBBLE = {
  far: 20,         // m: past this the bubble is hidden (out of view or past it: placeMarker's small marker on the screen's edge)
  fadeFrom: 11,    // m: full strength nearer than this, fading to `faint` at `far`
  faint: 0.45,
  gap: 26,         // px between the head and the bubble's tail tip (room for the name tag under it)
  gutter: 10,      // px kept from the screen's sides
  long: 90,        // letters: a speech longer than this, in two or more lines, is said in parts
};

export function bubbleFade(dist) {
  const d = +dist || 0;
  if (d > BUBBLE.far) return 0;
  if (d <= BUBBLE.fadeFrom) return 1;
  return 1 - (1 - BUBBLE.faint) * (d - BUBBLE.fadeFrom) / (BUBBLE.far - BUBBLE.fadeFrom);
}

export function bubbleParts(lines) {
  const L = (Array.isArray(lines) ? lines : [lines]).filter(Boolean);
  if (L.length > 1 && L.join(' ').length > BUBBLE.long) return L.map((l) => [l]);
  return [L];
}

export function partAt(parts, f) {
  const n = parts.map((p) => p.join(' ').length), all = n.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  for (let i = 0; i < parts.length; i++) { acc += n[i] / all; if (f < acc) return i; }
  return parts.length - 1;
}

export function placeBubble(el, at, camera, { dist = 0, avoid = [], below = Infinity } = {}) {
  const fade = bubbleFade(dist);
  if (!fade) return false;
  at.project(camera);
  if (at.z > 1 || Math.abs(at.x) > 1.02 || Math.abs(at.y) > 1.02) return false;   // (behind the camera, or off the screen)
  const W = innerWidth, H = innerHeight;
  const x = (at.x + 1) / 2 * W, y = (1 - at.y) / 2 * H;
  const w = el.offsetWidth, h = el.offsetHeight;
  const left = Math.max(BUBBLE.gutter, Math.min(W - w - BUBBLE.gutter, x - w / 2));
  let top = y - h - BUBBLE.gap, low = false;
  // (the head right under the job's card up top: just below the card, over the speaker still)
  for (const e of avoid) {
    if (!e || e.hidden || !e.offsetParent) continue;
    const q = e.getBoundingClientRect();
    if (q.height && q.top < H * 0.5 && q.right > left - 6 && q.left < left + w + 6 && top < q.bottom + 8) { top = q.bottom + 8; low = true; }
  }
  if (top < 4) { top = 4; low = true; }
  if (top + h > below - 8 && !low) top = Math.max(4, below - 8 - h);
  el.classList.toggle('is-low', low);
  el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  el.style.setProperty('--tail', `${Math.max(16, Math.min(w - 16, x - left))}px`);
  el.style.setProperty('--fade', fade.toFixed(2));
  return true;
}

// A line said while the speaker is out of view: a small marker (their name in a little bubble, an arrow toward them) on
// the screen's edge nearest them, sliding along it as the view turns; gone once their full bubble shows (the game's
// maker: "a small indication on the side of the screen that is nearest to them"). Behind the camera: the nearer side.
// Kept off the HUD's corners (the purse up top left, the menu top right) and the bottom bar.
//   placeMarker(el, at, camera)   at: the world point over the head (changed: moved into the camera's space)
//   markerName(name) -> a short name for it ("Sheriff Boone" -> "Boone", "Hank Dawson" -> "Hank")
export function markerName(name) {
  const w = String(name || '').split(/\s+/).filter((x) => x && !/^(Miss|Mrs\.?|Mr\.?|Doc|Sheriff|Deputy)$/.test(x));
  return w[0] || String(name || '');
}
export function placeMarker(el, at, camera) {
  const W = innerWidth, H = innerHeight, phone = W < 600;
  const L = 60, R = W - 60, T = phone ? 150 : 128, B = H - (phone ? 190 : 130);
  const cx = W / 2, cy = (T + B) / 2;
  at.applyMatrix4(camera.matrixWorldInverse);
  let dx, dy;
  if (at.z > -0.2) { dx = at.x >= 0 ? 1 : -1; dy = 0; }   // (behind the camera: the nearer side, half way up)
  else {
    at.applyMatrix4(camera.projectionMatrix);
    const sx = (at.x + 1) / 2 * W, sy = (1 - at.y) / 2 * H;
    dx = sx - cx; dy = sy - cy;
    if (!dx && !dy) dx = 1;
  }
  // (from the middle toward them, out to the edge of the box kept clear of the HUD)
  const k = Math.min(dx > 0 ? (R - cx) / dx : dx < 0 ? (L - cx) / dx : Infinity, dy > 0 ? (B - cy) / dy : dy < 0 ? (T - cy) / dy : Infinity);
  const x = cx + dx * k, y = cy + dy * k;
  el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -50%)`;
  el.style.setProperty('--a', `${Math.atan2(dy, dx).toFixed(3)}rad`);
}
