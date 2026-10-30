// GRAPHICS CHECK (Mathwood Valley): what this screen's graphics can do and what went wrong loading, in one panel a
// phone can screenshot (the menu's "Graphics check"), plus the two repairs it reports on:
//   - every failed load is counted (pictures, models, sounds: its address and why), and a picture or file that failed
//     on the network is tried twice more (a short wait between) before giving up. What loads, and when, is unchanged:
//     the retries live inside fetch and three's ImageLoader, so every loader in the game gets them.
//   - the graphics card's context lost (a phone short of memory, or a driver reset) is kept for a restore, and on the
//     restore every picture in the scene is marked to go up to the card again; both are logged.
// Installed on import (main.js imports this first, before anything starts loading).
//   watchGraphics(renderer, { scenes }) -> GFX   (once the renderer is made)
//   openGfxCheck({ renderer, quality, scenes, errors, panel, copy, onClose })   the panel (panel: shop.js makePanel, passed
//     in so this file, imported first, pulls in nothing of the game's)
//   gfxReport({ renderer, quality, scenes, errors }) -> text         what Copy copies (rigs read it too)
//   shaderUse(renderer, scenes) -> [{ name, used, frag: { samplers, vectors }, vert: {...} }]
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { gpuMemory } from '../world/gpumem.js';

export const GFX = { failed: [], retries: 0, recovered: [], lost: [], restored: [], shaderErrors: [], uploads: [] };
const TRIES = 2, WAIT = (n) => 350 * n * n;   // (two more tries: after 0.35 s, then 1.4 s)
const now = () => +(performance.now() / 1000).toFixed(1);
const short = (u) => { try { const x = new URL(String(u), location.href); return x.origin === location.origin ? x.pathname + x.search : x.href; } catch (e) { return String(u); } };
const failed = (kind, url, why, tries) => { if (GFX.failed.length < 200) GFX.failed.push({ kind, url: short(url), why: String(why || 'failed'), tries, t: now() }); };
const recovered = (kind, url, tries) => { if (GFX.recovered.length < 200) GFX.recovered.push({ kind, url: short(url), tries, t: now() }); };
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const kindOf = (u) => /\.(png|jpe?g|webp|gif|ktx2|avif)(\?|$)/i.test(u) ? 'picture' : /\.(glb|gltf|bin)(\?|$)/i.test(u) ? 'model' : /\.(mp3|ogg|wav|m4a|webm|opus)(\?|$)/i.test(u) ? 'sound' : 'file';

// ── fetch: the models (FileLoader), the models' pictures (ImageBitmapLoader), the sounds, the land's bake ─────────
{
  const real = window.fetch && window.fetch.bind(window);
  const again = (s) => s >= 500 || s === 408 || s === 429;   // (a server or a network hiccup; a 404 is a missing file, not tried again)
  if (real) window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input && input.url) || '';
    const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    if (method !== 'GET' || /^(data|blob):/.test(url)) return real(input, init);
    for (let n = 0; ; n++) {
      try {
        const r = await real(input, init);
        if (r.ok || r.type === 'opaque' || !again(r.status) || n >= TRIES) {
          if (!r.ok && r.type !== 'opaque') failed(kindOf(url), url, 'HTTP ' + r.status, n); else if (n) recovered(kindOf(url), url, n);
          return r;
        }
      } catch (e) {
        if ((e && e.name === 'AbortError') || (init && init.signal && init.signal.aborted)) throw e;
        if (n >= TRIES) { failed(kindOf(url), url, (e && e.message) || e, n); throw e; }
      }
      GFX.retries++; await sleep(WAIT(n + 1));
    }
  };
}
// ── three's ImageLoader: every TextureLoader picture (the ground, the stamps, the rocks, the models' pictures where
// the browser has no ImageBitmap) ──────────────────────────────────────────────────────────────────────────────────
{
  const P = THREE.ImageLoader.prototype, load = P.load;
  P.load = function (url, onLoad, onProgress, onError) {
    const self = this; let n = 0, first = null;
    const go = () => {
      const img = load.call(self, url, (im) => { if (n) recovered('picture', (self.path || '') + url, n); if (onLoad) onLoad(im); }, onProgress, (ev) => {
        if (n < TRIES && !/^(data|blob):/.test(url)) { n++; GFX.retries++; setTimeout(go, WAIT(n)); return; }
        failed('picture', (self.path || '') + url, (ev && ev.message) || 'the picture did not load', n);
        if (onError) onError(ev);
      });
      if (!first) first = img;
      return img;
    };
    return go();
  };
}
// ── a model that loaded but would not open (a cut-short file, a decoder short of memory): counted, not retried ──
{
  const P = GLTFLoader.prototype, load = P.load;
  P.load = function (url, onLoad, onProgress, onError) {
    return load.call(this, url, onLoad, onProgress, (e) => {
      if (!GFX.failed.some((f) => f.url === short((this.path || '') + url))) failed('model', (this.path || '') + url, (e && e.message) || e, 0);
      if (onError) onError(e); else console.error(e);
    });
  };
}
// ── a sound that came but would not decode ───────────────────────────────────────────────────────────────────────
{
  const AC = window.BaseAudioContext || window.AudioContext || window.webkitAudioContext;
  const dec = AC && AC.prototype.decodeAudioData;
  if (dec) AC.prototype.decodeAudioData = function (buf, ok, no) {
    let told = false; const tell = (e) => { if (told) return; told = true; failed('sound', `a sound (${buf && buf.byteLength ? Math.round(buf.byteLength / 1024) + ' KB' : 'empty'})`, 'could not decode: ' + ((e && e.message) || e), 0); };
    const p = dec.call(this, buf, ok, (e) => { tell(e); if (no) no(e); });
    if (p && p.then) p.then(null, tell);
    return p;
  };
}

// ── the renderer: shader errors, context lost and restored ──────────────────────────────────────────────────────
export function watchGraphics(renderer, { scenes = () => [] } = {}) {
  const gl = renderer.getContext(), canvas = renderer.domElement;
  if (renderer.debug) {
    renderer.debug.checkShaderErrors = true;
    renderer.debug.onShaderError = (g, program, vs, fs) => {
      const log = (s) => (s && g.getShaderInfoLog(s)) || '';
      const text = [g.getProgramInfoLog(program), log(vs), log(fs)].map((s) => String(s || '').trim()).filter(Boolean).join(' | ').slice(0, 600);
      if (GFX.shaderErrors.length < 20) GFX.shaderErrors.push({ t: now(), text: text || 'did not link (no log)' });
      console.error('a shader did not compile:', text);
    };
  }
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); GFX.lost.push(now()); console.warn('graphics: the context was lost; waiting for it back'); }, false);
  canvas.addEventListener('webglcontextrestored', () => {
    // (three has already set itself up again by now (its listener came first) and uploads each picture again when
    // it's next drawn; marking them makes sure, and says which can't go back up: a picture whose pixels were let go)
    const mem = gpuMemory(renderer); if (mem && mem.reset) mem.reset();
    const r = remark(scenes());
    GFX.restored.push(now()); GFX.uploads.push(r);
    console.warn(`graphics: the context is back; ${r.marked} pictures marked to go up again${r.gone ? `, ${r.gone} with no pixels left` : ''}`);
  }, false);
  window.BM && (window.BM.gfx = GFX);
  return GFX;
}
function eachTexture(scenes, fn) {
  const seen = new Set(), mats = new Set();
  const look = (v) => { if (v && v.isTexture && !seen.has(v)) { seen.add(v); fn(v); } };
  for (const s of scenes) {
    if (!s) continue;
    look(s.background); look(s.environment);
    s.traverse((o) => { const m = o.material; if (m) for (const x of Array.isArray(m) ? m : [m]) mats.add(x); });
  }
  for (const m of mats) {
    for (const k in m) look(m[k]);
    if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k] && m.uniforms[k].value; if (Array.isArray(v)) v.forEach(look); else look(v); }
    const sh = m.userData && m.userData.shader; if (sh && sh.uniforms) for (const k in sh.uniforms) look(sh.uniforms[k] && sh.uniforms[k].value);
  }
}
function remark(scenes) {
  let marked = 0, gone = 0;
  eachTexture(scenes, (t) => {
    if (t.isRenderTargetTexture) return;
    const im = t.image;
    const has = im && (im.data || im.width > 0 || im.naturalWidth > 0 || (Array.isArray(im) && im.length) || (t.mipmaps && t.mipmaps.length));
    if (!has) { if (t.version > 0) gone++; return; }
    t.needsUpdate = true; marked++;
  });
  return { marked, gone };
}

// ── the shaders: samplers and uniform vectors each one uses, against the card's limits ──────────────────────────
const SAMPLERS = new Set([0x8B5E, 0x8B5F, 0x8B60, 0x8B62, 0x8DC1, 0x8DC4, 0x8DC5, 0x8DCA, 0x8DCB, 0x8DCC, 0x8DCF, 0x8DD2, 0x8DD3, 0x8DD4, 0x8DD7]);
const ROWS = { 0x8B5A: 2, 0x8B5B: 3, 0x8B5C: 4, 0x8B65: 3, 0x8B66: 4, 0x8B67: 2, 0x8B68: 4, 0x8B69: 3, 0x8B6A: 4 };   // (mat2..mat4, mat2x3..mat4x3: a vector a column)
export function shaderUse(renderer, scenes = []) {
  const gl = renderer.getContext(), out = [], names = new Map();
  try {
    for (const s of scenes) if (s) s.traverse((o) => {
      if (!o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        const p = renderer.properties.get(m), prog = p && p.currentProgram; if (!prog) continue;
        const a = names.get(prog) || []; if (a.length < 4) { const n = o.name || m.name || m.type; if (!a.includes(n)) a.push(n); } names.set(prog, a);
      }
    });
  } catch (e) { /* (names are a nicety) */ }
  for (const prog of renderer.info.programs || []) {
    const p = prog.program; if (!p) continue;
    let fs = '', vs = '';
    try { for (const sh of gl.getAttachedShaders(p) || []) { const src = gl.getShaderSource(sh) || ''; if (gl.getShaderParameter(sh, gl.SHADER_TYPE) === gl.FRAGMENT_SHADER) fs = src; else vs = src; } } catch (e) { /* */ }
    const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    fs = strip(fs); vs = strip(vs);
    const f = { samplers: 0, vectors: 0 }, v = { samplers: 0, vectors: 0 };
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) || 0;
    for (let i = 0; i < n; i++) {
      const u = gl.getActiveUniform(p, i); if (!u) continue;
      const root = u.name.split(/[.[]/)[0], re = new RegExp('\\b' + root + '\\b');
      const isS = SAMPLERS.has(u.type), rows = (ROWS[u.type] || 1) * u.size;
      for (const [src, c] of [[fs, f], [vs, v]]) if (re.test(src)) { if (isS) c.samplers += u.size; else c.vectors += rows; }
    }
    out.push({ name: prog.name || 'shader', used: (names.get(prog) || []).join(', '), frag: f, vert: v });
  }
  return out.sort((a, b) => b.frag.samplers - a.frag.samplers || b.frag.vectors - a.frag.vectors);
}

// ── the report ──────────────────────────────────────────────────────────────────────────────────────────────────
function facts({ renderer, quality, scenes = [], errors = [] }) {
  const gl = renderer.getContext(), P = (k) => { try { return gl.getParameter(k); } catch (e) { return '?'; } };
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const isGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  const mem = gpuMemory(renderer), tot = mem ? mem.total() : null, info = renderer.info;
  const lim = { tex: P(gl.MAX_TEXTURE_SIZE), units: P(gl.MAX_TEXTURE_IMAGE_UNITS), vunits: P(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS), all: P(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS), fvec: P(gl.MAX_FRAGMENT_UNIFORM_VECTORS), vvec: P(gl.MAX_VERTEX_UNIFORM_VECTORS) };
  return {
    card: [
      ['WebGL', `${isGL2 ? '2' : '1'} (${P(gl.VERSION)})`],
      ['Graphics', dbg ? String(P(dbg.UNMASKED_RENDERER_WEBGL)) : String(P(gl.RENDERER))],
      ['Maker', dbg ? String(P(dbg.UNMASKED_VENDOR_WEBGL)) : String(P(gl.VENDOR))],
      ['Context', gl.isContextLost() ? 'LOST' : 'working'],
      ['Error flag', glError(gl)],   // (WebGL keeps its first error until asked, and three never asks: OUT_OF_MEMORY here means a picture or buffer didn't fit)
      ['Biggest picture', lim.tex], ['Pictures a shader', `${lim.units} (vertex ${lim.vunits}, all ${lim.all})`],
      ['Uniforms', `fragment ${lim.fvec}, vertex ${lim.vvec} vectors`],
      ['Quality', quality ? `${quality.tier} (${quality.why || quality.source || ''})` : '?'],
      ['Memory', navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'not told'],
      ['Pixel ratio', `${devicePixelRatio} screen, ${renderer.getPixelRatio()} drawn, ${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`],
      ['In memory', `${info.memory.textures} pictures, ${info.memory.geometries} shapes, ${(info.programs || []).length} shaders`],
      ['Drawn', `${info.render.calls} draw calls, ${Math.round(info.render.triangles / 1000)}k triangles`],
      ['Picture memory', tot ? `about ${tot.textures} MB in ${tot.count} pictures (+${tot.buffers} buffers, ${tot.screen} screen)` : '?'],
      ['Biggest ones', mem ? mem.biggest(4).map((b) => `${b.w}x${b.h} ${b.mb} MB`).join(', ') : '?'],
    ],
    lim, shaders: shaderUse(renderer, scenes), errors,
  };
}
export function gfxReport(o) {
  const F = facts(o), L = [];
  L.push('Mathwood Valley graphics check · ' + new Date().toISOString().slice(0, 19).replace('T', ' ') + ' · ' + navigator.userAgent);
  for (const [k, v] of F.card) L.push(`${k}: ${v}`);
  L.push(`Failed loads: ${GFX.failed.length}`); for (const f of GFX.failed) L.push(`  ${f.kind} ${f.url} : ${f.why} (after ${f.tries} retries, ${f.t}s)`);
  L.push(`Retries: ${GFX.retries}, recovered ${GFX.recovered.length}`); for (const f of GFX.recovered) L.push(`  ${f.kind} ${f.url} (try ${f.tries + 1})`);
  L.push(`Context lost: ${GFX.lost.length ? GFX.lost.join('s, ') + 's' : 'never'} · restored: ${GFX.restored.length ? GFX.restored.map((t, i) => `${t}s (${GFX.uploads[i].marked} pictures up again${GFX.uploads[i].gone ? ', ' + GFX.uploads[i].gone + ' with no pixels' : ''})`).join(', ') : 'never'}`);
  L.push(`Shader errors: ${GFX.shaderErrors.length}`); for (const s of GFX.shaderErrors) L.push(`  ${s.t}s ${s.text}`);
  L.push(`Game errors: ${F.errors.length}`); for (const e of F.errors.slice(-12)) L.push('  ' + String(e).slice(0, 200));
  L.push('Shaders (fragment samplers/vectors, vertex samplers/vectors):');
  for (const s of F.shaders.slice(0, 12)) L.push(`  ${s.frag.samplers}/${s.frag.vectors} · ${s.vert.samplers}/${s.vert.vectors}  ${s.name}${s.used ? ' [' + s.used + ']' : ''}${over(s, F.lim) ? '  OVER: ' + over(s, F.lim) : ''}`);
  return L.join('\n');
}
// (over this card's limit, or over a common phone's: 16 pictures a shader, 224 fragment vectors)
function over(s, lim) {
  const w = [];
  if (s.frag.samplers > Math.min(16, lim.units || 16)) w.push(`${s.frag.samplers} pictures`);
  if (s.frag.vectors > Math.min(224, lim.fvec || 224)) w.push(`${s.frag.vectors} fragment vectors`);
  if (s.vert.vectors > Math.min(256, lim.vvec || 256)) w.push(`${s.vert.vectors} vertex vectors`);
  return w.join(', ');
}

const GL_ERR = { 0x0500: 'INVALID_ENUM', 0x0501: 'INVALID_VALUE', 0x0502: 'INVALID_OPERATION', 0x0505: 'OUT_OF_MEMORY (the card ran out: pictures may be blank)', 0x0506: 'INVALID_FRAMEBUFFER_OPERATION', 0x9242: 'CONTEXT_LOST' };
const seenErr = [];
function glError(gl) { for (let e, i = 0; i < 8 && (e = gl.getError()); i++) if (!seenErr.includes(e)) seenErr.push(e); return seenErr.length ? seenErr.map((e) => GL_ERR[e] || '0x' + e.toString(16)).join(', ') : 'none'; }
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let css = false;
function ensureCss() {
  if (css) return; css = true;
  const s = document.createElement('style');
  s.textContent = `.gfx{font:12px/1.35 system-ui,sans-serif;max-width:560px}
.gfx dl{display:grid;grid-template-columns:max-content 1fr;gap:2px 10px;margin:0 0 8px}
.gfx dt{opacity:.7}.gfx dd{margin:0;overflow-wrap:anywhere}
.gfx h3{font-size:13px;margin:10px 0 3px}.gfx ul{margin:0;padding-left:16px;overflow-wrap:anywhere}
.gfx .bad{color:#b4231b;font-weight:700}.gfx .ok{opacity:.7}
.gfx-copy{margin-top:10px;padding:8px 16px;font:inherit;font-weight:700;border-radius:8px;border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer}`;
  document.head.appendChild(s);
}
export function openGfxCheck({ renderer, quality, scenes = [], errors = [], onClose = () => {}, copy, panel }) {
  ensureCss();
  const F = facts({ renderer, quality, scenes, errors }), el = document.createElement('div');
  el.className = 'gfx';
  const list = (a, fn, none) => a.length ? `<ul>${a.map((x) => `<li>${fn(x)}</li>`).join('')}</ul>` : `<div class="ok">${none}</div>`;
  el.innerHTML = `<dl>${F.card.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    <h3 class="${GFX.failed.length ? 'bad' : ''}">Failed loads: ${GFX.failed.length}</h3>${list(GFX.failed, (f) => `${esc(f.kind)} ${esc(f.url)}: ${esc(f.why)}`, 'none')}
    <h3>Tried again: ${GFX.retries}, came good: ${GFX.recovered.length}</h3>${list(GFX.recovered, (f) => `${esc(f.url)} (try ${f.tries + 1})`, '')}
    <h3 class="${GFX.lost.length ? 'bad' : ''}">Graphics lost: ${GFX.lost.length}, back: ${GFX.restored.length}</h3>
    <h3 class="${GFX.shaderErrors.length ? 'bad' : ''}">Shader errors: ${GFX.shaderErrors.length}</h3>${list(GFX.shaderErrors, (s) => esc(s.text.slice(0, 160)), '')}
    <h3 class="${errors.length ? 'bad' : ''}">Game errors: ${errors.length}</h3>${list(errors.slice(-6), (e) => esc(String(e).slice(0, 160)), '')}
    <h3>Busiest shaders (pictures / uniform vectors)</h3>${list(F.shaders.slice(0, 5), (s) => `<span class="${over(s, F.lim) ? 'bad' : ''}">${s.frag.samplers} / ${s.frag.vectors}</span>${!over(s, F.lim) && s.frag.samplers >= 16 ? ' <b>(at a phone\'s limit of 16)</b>' : ''} ${esc(s.name)}${s.used ? ' · ' + esc(s.used) : ''}`, 'none yet')}
    <button type="button" class="gfx-copy">Copy</button> <span class="gfx-said" role="status"></span>`;
  el.querySelector('.gfx-copy').addEventListener('click', async () => {
    const text = gfxReport({ renderer, quality, scenes, errors }); let ok = false;
    try { ok = copy ? await copy(text) : (await navigator.clipboard.writeText(text), true); } catch (e) { ok = false; }
    el.querySelector('.gfx-said').textContent = ok ? 'Copied! Paste it in a message' : 'Could not copy: take a screenshot';
  });
  return panel({ title: 'Graphics check', sub: 'What this screen can do, and anything that did not load', body: el, onClose });
}
