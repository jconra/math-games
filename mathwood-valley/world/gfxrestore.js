// AFTER A GRAPHICS RESTORE (Mathwood Valley): what the game made ON the graphics card (a picture drawn into a render
// target, a shadow map drawn once, a timer query) is gone when the card's context is lost; three makes its own GL
// objects again on the restore, but not their contents. Each piece that draws such a thing registers here how to make it
// again, and src/gfxcheck.js runs them all on 'webglcontextrestored' (after three has set itself up again) and lists
// them in the Graphics check.
//   onGraphicsRestored(name, fn) -> off()   fn() returns false/0 for "nothing to do", a string for a detail, else anything
//   runRestored() -> ['name', 'name (detail)', ...]
export const RESTORE = { jobs: new Map(), last: [] };
export function onGraphicsRestored(name, fn) { RESTORE.jobs.set(name, fn); return () => { if (RESTORE.jobs.get(name) === fn) RESTORE.jobs.delete(name); }; }
export function runRestored() {
  const out = [];
  for (const [name, fn] of RESTORE.jobs) {
    try { const r = fn(); if (r !== false && r !== 0 && r != null) out.push(typeof r === 'string' || typeof r === 'number' ? `${name} (${r})` : name); }
    catch (e) { out.push(`${name}: FAILED (${(e && e.message) || e})`); console.error('graphics restore:', name, e); }
  }
  RESTORE.last = out;
  return out;
}
