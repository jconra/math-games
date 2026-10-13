// WOOD, painted in code: board grain (long streaks, now and then a knot) and plank walls for the mill. Canvas textures,
// so the lab needs no picture files of its own.
import * as THREE from 'three';

// a small repeatable random number maker, so the same seed always paints the same board
export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// one board's grain, long side along x. tint: the timber's colour [r, g, b] 0..255
export function boardTexture(seed = 1, tint = [176, 128, 82]) {
  const w = 512, h = 64, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'), r = rng(seed);
  g.fillStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`; g.fillRect(0, 0, w, h);
  // grain: long, slightly wavy lines, darker and lighter
  for (let i = 0; i < 46; i++) {
    const y0 = r() * h, dark = r() < 0.7, a = 0.06 + r() * 0.16, amp = 1 + r() * 4, f = 0.004 + r() * 0.01, ph = r() * 6;
    g.strokeStyle = dark ? `rgba(70,40,18,${a})` : `rgba(255,225,180,${a * 0.8})`; g.lineWidth = 0.6 + r() * 1.8;
    g.beginPath();
    for (let x = 0; x <= w; x += 8) { const y = y0 + Math.sin(x * f + ph) * amp; x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }
  // a knot or two, with the grain swirled round them
  const knots = r() < 0.6 ? 1 + (r() < 0.3 ? 1 : 0) : 0;
  for (let k = 0; k < knots; k++) {
    const cx = 40 + r() * (w - 80), cy = 14 + r() * (h - 28), rad = 3 + r() * 4;
    for (let i = 5; i > 0; i--) { g.strokeStyle = `rgba(80,45,20,${0.12 + i * 0.03})`; g.lineWidth = 1.2; g.beginPath(); g.ellipse(cx, cy, rad * i * 0.9, rad * i * 0.45, 0, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = 'rgba(60,32,14,0.85)'; g.beginPath(); g.ellipse(cx, cy, rad, rad * 0.7, 0, 0, Math.PI * 2); g.fill();
  }
  // weathering: a fine speckle
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 18; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.8; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

// a wall of upright planks with dark gaps between them (the mill's walls, the lumber pile's ends)
export function plankTexture(seed = 7, tint = [122, 88, 58]) {
  const w = 256, h = 256, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'), r = rng(seed), n = 6, pw = w / n;
  for (let i = 0; i < n; i++) {
    const v = 0.82 + r() * 0.3;
    g.fillStyle = `rgb(${tint[0] * v | 0},${tint[1] * v | 0},${tint[2] * v | 0})`; g.fillRect(i * pw, 0, pw, h);
    for (let j = 0; j < 14; j++) {
      const x0 = i * pw + r() * pw; g.strokeStyle = `rgba(50,30,15,${0.08 + r() * 0.14})`; g.lineWidth = 0.5 + r() * 1.4;
      g.beginPath(); g.moveTo(x0, 0); g.bezierCurveTo(x0 + (r() - 0.5) * 6, h * 0.3, x0 + (r() - 0.5) * 6, h * 0.7, x0 + (r() - 0.5) * 4, h); g.stroke();
    }
    g.fillStyle = 'rgba(25,15,8,0.85)'; g.fillRect(i * pw, 0, 2, h);
    // nail heads near top and bottom
    g.fillStyle = 'rgba(40,36,34,0.9)'; for (const y of [14, h - 14]) { g.beginPath(); g.arc(i * pw + pw / 2, y, 2, 0, 7); g.fill(); }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

// a soft round dot (dust puffs, leaves' fallback)
export function softDot(size = 64) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
