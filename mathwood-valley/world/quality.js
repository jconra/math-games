// QUALITY TIERS: potato, normal, gaming. Picked once from what the browser says about the machine,
// then corrected by how fast the first seconds actually run; a page can offer a selector, and the
// choice is remembered. ?q=potato|normal|gaming in the address forces one. Each page decides what
// a tier means for its own settings - this only decides the tier.
//
// Detection, in order:
//   a software renderer (SwiftShader, llvmpipe)    -> potato
//   no WebGL2                                      -> potato (Jacob's work PC)
//   under 4 GB of memory or 4 cores                -> potato
//   a phone or tablet                              -> normal
//   a known dedicated GPU (GeForce, Radeon RX/Pro, Apple M, Arc) -> gaming
//   anything else (integrated graphics)            -> normal
//
// (Mathwood Valley) THE GOVERNOR'S MEMORY (world/governor.js): with the tier left on Auto, the game remembers, for each
// graphics card, the rungs the governor last held there (or wanted, for the scenery) and the band the scenery's falls in. The next load starts in
// that band (the settings that need a reload: the land's mesh, the screen's smoothing, the shadow map, the models'
// pictures), and the governor carries on from the level it held. A tier chosen by hand (saveTier) or in the address
// (?q=) pins it: no memory is used then.
//   chooseTier(renderer)  forced (?q=) > chosen by hand > remembered for this card > detected
//   probeGpu()            { name, gl2 } of the graphics card, from a throwaway context (before the game's renderer is
//                         made, for its smoothing: wantAntialias)
//   loadBand()            the tier this load will be, before the renderer is made (the same answer chooseTier gives)
//   wantAntialias()       false where the tier will be potato (the screen's smoothing costs a fill-bound machine most)
//   recall(gpu) / remember(gpu, rec)   the governor's record for a card: { v, scenery, people, band, at, hz }
import { watchGpuMemory } from './gpumem.js';
export const TIERS = ['potato', 'normal', 'gaming'];
const KEY = 'jconra.quality';

export function gpuName(renderer) {
  try {
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
  } catch (e) { return ''; }
}

export function detectTier(renderer) {
  const name = gpuName(renderer), mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 8;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);
  if (/SwiftShader|llvmpipe|Software|Basic Render/i.test(name)) return { tier: 'potato', why: 'software rendering, no graphics card in use' };
  if (!renderer.capabilities.isWebGL2) return { tier: 'potato', why: 'no WebGL2' + (name ? ' · ' + name : '') };
  if (mem < 4 || cores < 4) return { tier: 'potato', why: `${mem} GB, ${cores} cores` };
  if (mobile) return { tier: 'normal', why: 'phone or tablet' };
  if (/GeForce|RTX|GTX|Quadro|Radeon (RX|Pro)|Apple M\d|Arc\(TM\)|Arc A/i.test(name)) return { tier: 'gaming', why: name };
  return { tier: 'normal', why: name || 'unknown graphics' };
}

// The tier to use now: forced by the address, else remembered, else detected.
export function chooseTier(renderer) {
  watchGpuMemory(renderer);   // (the graphics memory counted from the start: the ?perf overlay's total, world/gpumem.js)
  const q = new URLSearchParams(location.search).get('q');
  if (TIERS.includes(q)) return { tier: q, why: 'from the address', source: 'forced' };
  try { const saved = localStorage.getItem(KEY); if (TIERS.includes(saved)) return { tier: saved, why: 'your choice', source: 'saved' }; } catch (e) { /* no storage */ }
  const det = detectTier(renderer), gpu = gpuName(renderer), rec = recall(gpu);
  if (rec && TIERS.includes(rec.band)) {
    // (a card with no WebGL 2 keeps the potato band for what needs a reload, however high the governor climbed live:
    // GOVERNOR.md, Questions for Dad)
    const band = !renderer.capabilities.isWebGL2 ? 'potato' : rec.band;
    return { tier: band, why: `remembered for this computer (scenery ${rec.scenery}, people ${rec.people})`, source: 'remembered', detected: det.tier };
  }
  return { ...det, source: 'detected', detected: det.tier };
}
export function saveTier(tier) { try { if (tier) localStorage.setItem(KEY, tier); else localStorage.removeItem(KEY); } catch (e) { /* no storage */ } }

// Watch the frame rate for a while after starting (the first `settle` seconds are skipped: loading
// and baking). If a detected tier runs under `floor` fps it steps down once, and calls `onChange`.
// Nothing happens for a tier the person chose or forced.
export function watchFrames(choice, onChange, { settle = 6, window = 4, floor = 28 } = {}) {
  if (choice.source !== 'detected') return () => {};
  let t0 = performance.now(), frames = 0, done = false;
  return function tick() {
    if (done) return;
    const t = (performance.now() - t0) / 1000;
    if (t < settle) return;
    frames++;
    if (t >= settle + window) {
      done = true;
      const fps = frames / window, i = TIERS.indexOf(choice.tier);
      if (fps < floor && i > 0) { choice.tier = TIERS[i - 1]; choice.why = `ran at ${fps.toFixed(0)} fps`; onChange(choice); }
    }
  };
}

// ── THE GOVERNOR'S MEMORY (world/governor.js) ─────────────────────────────────────────────────────────────────
const MEM = 'mathwood.governor';
const cardKey = (gpu) => String(gpu || 'unknown').replace(/\s+/g, ' ').trim().slice(0, 160);
function memory() { try { const m = JSON.parse(localStorage.getItem(MEM) || 'null'); return m && m.cards ? m : { cards: {} }; } catch (e) { return { cards: {} }; } }
export function recall(gpu) { const r = memory().cards[cardKey(gpu)]; return r && Number.isFinite(r.scenery) && TIERS.includes(r.band) ? r : null; }
export function remember(gpu, rec) {
  try { const m = memory(); if (rec) m.cards[cardKey(gpu)] = { ...rec, at: Date.now() }; else delete m.cards[cardKey(gpu)]; localStorage.setItem(MEM, JSON.stringify(m)); } catch (e) { /* no storage */ }
}
export function savedTier() { try { const s = localStorage.getItem(KEY); return TIERS.includes(s) ? s : null; } catch (e) { return null; } }

// the graphics card's name and whether it does WebGL 2, from a throwaway context (let go at once)
let probed = null;
export function probeGpu() {
  if (probed) return probed;
  probed = { name: '', gl2: false };
  try {
    const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl');
    if (gl) {
      probed.gl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      probed.name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    }
  } catch (e) { /* (no WebGL at all: the game says so itself) */ }
  return probed;
}
// THE BAND THIS LOAD WILL BE, before the game's renderer is made (chooseTier's answer, from the throwaway context's
// card): for what must be chosen that early, the screen's smoothing and the files the game starts loading at once
export function loadBand() {
  const q = new URLSearchParams(location.search).get('q');
  if (TIERS.includes(q)) return q;
  const saved = savedTier(); if (saved) return saved;
  const g = probeGpu(), rec = recall(g.name);
  if (rec && TIERS.includes(rec.band)) return g.gl2 ? rec.band : 'potato';
  const mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 8;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);
  if (/SwiftShader|llvmpipe|Software|Basic Render/i.test(g.name) || !g.gl2 || mem < 4 || cores < 4) return 'potato';
  if (mobile) return 'normal';
  return /GeForce|RTX|GTX|Quadro|Radeon (RX|Pro)|Apple M\d|Arc\(TM\)|Arc A/i.test(g.name) ? 'gaming' : 'normal';
}
// the screen's smoothing (multisampling): off where the tier will be potato (forced, chosen, remembered, or a machine the
// detection would call potato), on otherwise; it can only be set when the renderer is made
export const wantAntialias = () => loadBand() !== 'potato';
