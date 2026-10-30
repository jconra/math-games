// GRAPHICS MEMORY, COUNTED (Mathwood Valley): every picture and render buffer the game puts on the graphics card,
// counted where WebGL is told its size (texImage2D, texStorage2D, compressed uploads, generateMipmap, renderbuffers),
// and let go where it is deleted; plus the screen's own buffers (colour and depth, times the smoothing's samples). An
// estimate of what the card holds for the page (a driver may pad or compress), close enough to see a 4096 picture go.
// For the ?perf overlay (world/governor.js) and the rigs.
//   watchGpuMemory(renderer) -> M   (once a renderer: installed before anything is uploaded)
//   M.total() -> { mb, textures: mb, buffers: mb, screen: mb, count }   M.biggest(n) -> [{ w, h, mb }]
const BPP = {   // bytes a texel, by WebGL's (internal) format
  0x8058: 4, 0x8051: 4, 0x1908: 4, 0x1907: 4, 0x8C43: 4, 0x8C41: 4,    // RGBA8, RGB8, RGBA, RGB (padded), SRGB8_ALPHA8, SRGB8
  0x1909: 1, 0x190A: 2, 0x1906: 1, 0x8229: 1, 0x822B: 2,                // LUMINANCE, LUMINANCE_ALPHA, ALPHA, R8, RG8
  0x881A: 8, 0x881B: 8, 0x8814: 16, 0x8815: 16, 0x822D: 2, 0x822F: 4, 0x822E: 4, 0x8230: 8,   // RGBA16F, RGB16F, RGBA32F, RGB32F, R16F, RG16F, R32F, RG32F
  0x81A5: 4, 0x81A6: 4, 0x8CAC: 4, 0x88F0: 4, 0x8CAD: 8, 0x1902: 4, 0x84F9: 4, 0x8D48: 1,   // DEPTH16/24 (padded), DEPTH32F, DEPTH24_STENCIL8, DEPTH32F_STENCIL8, DEPTH_COMPONENT, DEPTH_STENCIL, STENCIL8
  0x8056: 2, 0x8057: 2, 0x8D62: 2, 0x8C3A: 4, 0x8C3D: 4, 0x8059: 4,      // RGBA4, RGB5_A1, RGB565, R11F_G11F_B10F, RGB9_E5, RGB10_A2
};
const TYPE_BPP = { 0x1406: 4, 0x140B: 2, 0x8D61: 2 };   // FLOAT, HALF_FLOAT, HALF_FLOAT_OES (an unsized format's texel is 4 channels of these)
const CUBE = (t) => t >= 0x8515 && t <= 0x851A;          // a cube map's six faces
export function watchGpuMemory(renderer) {
  const gl = renderer.getContext();
  if (gl.__mvMem) return gl.__mvMem;
  const tex = new Map(), rb = new Map(), unitOf = new Map();
  let unit = 0, rbBound = null;
  const bind = new Map();   // "unit:target" -> texture
  const key = (target) => unit + ':' + (CUBE(target) ? 0x8513 : target);
  const at = (target) => bind.get(key(target)) || null;
  const rec = (t) => { let r = tex.get(t); if (!r) { r = { levels: new Map(), w: 0, h: 0, mip: false }; tex.set(t, r); } return r; };
  const bppOf = (fmt, type) => BPP[fmt] ? (type && TYPE_BPP[type] && (fmt === 0x1908 || fmt === 0x1907) ? 4 * TYPE_BPP[type] : BPP[fmt]) : 4;
  const wrap = (name, fn) => { const f = gl[name]; if (typeof f !== 'function') return; gl[name] = function (...a) { try { fn(...a); } catch (e) { /* (counting never gets in the way) */ } return f.apply(gl, a); }; };
  wrap('activeTexture', (u) => { unit = u - 0x84C0; });
  wrap('bindTexture', (target, t) => { bind.set(key(target), t); });
  wrap('deleteTexture', (t) => { tex.delete(t); });
  // texImage2D(target, level, internalformat, width, height, border, format, type, pixels) or (target, level,
  // internalformat, format, type, source)
  wrap('texImage2D', (target, level, ifmt, ...rest) => {
    const t = at(target); if (!t) return;
    let w, h, type;
    if (rest.length >= 6) { w = rest[0]; h = rest[1]; type = rest[4]; } else { const src = rest[2]; type = rest[1]; w = src && (src.videoWidth || src.naturalWidth || src.width); h = src && (src.videoHeight || src.naturalHeight || src.height); }
    const r = rec(t); r.levels.set(level + ':' + target, (w * h || 0) * bppOf(ifmt, type)); if (level === 0) { r.w = w; r.h = h; }
  });
  wrap('compressedTexImage2D', (target, level, ifmt, w, h, border, data) => {
    const t = at(target); if (!t) return;
    const r = rec(t); r.levels.set(level + ':' + target, data && data.byteLength ? data.byteLength : 0); if (level === 0) { r.w = w; r.h = h; }
  });
  wrap('texStorage2D', (target, levels, ifmt, w, h) => {
    const t = at(target); if (!t) return;
    const r = rec(t); r.levels.clear(); r.w = w; r.h = h;
    for (let l = 0; l < levels; l++) r.levels.set(l + ':' + target, Math.max(1, w >> l) * Math.max(1, h >> l) * bppOf(ifmt) * (target === 0x8513 ? 6 : 1));
  });
  wrap('texStorage3D', (target, levels, ifmt, w, h, d) => {
    const t = at(target); if (!t) return;
    const r = rec(t); r.levels.clear(); r.w = w; r.h = h;
    for (let l = 0; l < levels; l++) r.levels.set('3d' + l, Math.max(1, w >> l) * Math.max(1, h >> l) * d * bppOf(ifmt));
  });
  wrap('texImage3D', (target, level, ifmt, w, h, d, border, format, type) => {
    const t = at(target); if (!t) return;
    const r = rec(t); r.levels.set('3d' + level, w * h * d * bppOf(ifmt, type)); if (level === 0) { r.w = w; r.h = h; }
  });
  wrap('generateMipmap', (target) => { const t = at(target); if (t) rec(t).mip = true; });
  wrap('bindRenderbuffer', (target, b) => { rbBound = b; });
  wrap('deleteRenderbuffer', (b) => { rb.delete(b); });
  wrap('renderbufferStorage', (target, fmt, w, h) => { if (rbBound) rb.set(rbBound, w * h * bppOf(fmt)); });
  wrap('renderbufferStorageMultisample', (target, samples, fmt, w, h) => { if (rbBound) rb.set(rbBound, w * h * bppOf(fmt) * Math.max(1, samples)); });
  const M = {
    reset() { tex.clear(); rb.clear(); bind.clear(); unitOf.clear(); rbBound = null; },   // (the context lost and back: every old handle is gone)
    total() {
      let t = 0; for (const r of tex.values()) { let s = 0; for (const b of r.levels.values()) s += b; if (r.mip && r.levels.size <= 6) s *= 4 / 3; t += s; }   // (one level given and its mipmaps made: a third more)
      let b = 0; for (const v of rb.values()) b += v;
      const attr = gl.getContextAttributes ? gl.getContextAttributes() : {}, samples = attr && attr.antialias ? 4 : 1;
      const scr = gl.drawingBufferWidth * gl.drawingBufferHeight * (4 * samples + 4 * samples + (samples > 1 ? 4 : 0) + 4);   // (colour and depth, multisampled, the resolved copy, and the page's own)
      const mb = (x) => +(x / 1048576).toFixed(1);
      return { mb: mb(t + b + scr), textures: mb(t), buffers: mb(b), screen: mb(scr), count: tex.size };
    },
    biggest(n = 8) {
      return [...tex.values()].map((r) => { let s = 0; for (const b of r.levels.values()) s += b; if (r.mip && r.levels.size <= 6) s *= 4 / 3; return { w: r.w, h: r.h, mb: +(s / 1048576).toFixed(1) }; }).sort((a, b) => b.mb - a.mb).slice(0, n);
    },
  };
  gl.__mvMem = M;
  return M;
}
export const gpuMemory = (renderer) => (renderer && renderer.getContext().__mvMem) || null;
