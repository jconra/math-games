// THE WOOD SHEET MADE OVER FOR A BUILDING (the Building Lab and the game share these): the trim sheet's painted nails taken
// out (eraseNails), and for a building that asks for it its grain calmed (softenGrain). Both work in place on the
// textures T (makeTextures in labs/materials/textures.js: T.wood, T.woodN), from canvases: run them in a page.

// THE CALMER GRAIN (the sheriff's office): the sheet's board strips carry a dozen fine, sharp grain lines each; on lap
// siding seen close they read as ribbed cloth and shimmer at a slant. Each board strip is blurred across its width (the
// fine lines melt into its tone; the knots stay, as soft blots), and three to five broad, soft streaks are laid along it,
// wandering a little and tiling round the strip's length; its bumps are flattened the same way. The strip's edges, the
// shakes and the end grain are left as drawn. (The stable keeps the sheet as it is.) o.straight (the general store): the
// streaks run dead along the strip, more of them and finer, mostly darker, as the grain lines of weathered siding
export function softenGrain(T, o = {}) {
  const S = 64, rows = 12, R = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  for (const [tex, isN] of [[T.wood, false], [T.woodN, true]]) {
    // (read through a scratch canvas made for reading back, write straight into the sheet)
    const c = tex.image, g = c.getContext('2d'), W = c.width, tmp = document.createElement('canvas'); tmp.width = W; tmp.height = S;
    const tg = tmp.getContext('2d', { willReadFrequently: true });
    const sig = 3.2, ker = []; for (let k = -8; k <= 8; k++) ker.push(Math.exp(-(k * k) / (2 * sig * sig)));
    for (let s = 0; s < rows; s++) {
      const y0 = s * S; tg.clearRect(0, 0, W, S); tg.drawImage(c, 0, y0, W, S, 0, 0, W, S);
      const img = tg.getImageData(0, 0, W, S), d = img.data, src = d.slice();
      // (straight: the two rough-sawn strips keep a few broad soft streaks, as their saw marks across them and fine lines
      // along them made a grid close up)
      const fine = o.straight && s < 10, bands = fine ? 9 + Math.floor(R(s * 3 + 1) * 5) : 3 + Math.floor(R(s * 3 + 1) * 3);
      const bc = Array.from({ length: bands }, (_, b) => fine
        ? [(b + 0.5) / bands * 54 + 5 + (R(s * 7 + b) - 0.5) * 4, 1.1 + R(s * 11 + b) * 1.4, R(s * 13 + b) < 0.75 ? -(0.04 + R(s * 19 + b) * 0.06) : 0.03 + R(s * 23 + b) * 0.03, 1, 0.5]
        : [(b + 0.5) / bands * 52 + 6 + (R(s * 7 + b) - 0.5) * 8, 3 + R(s * 11 + b) * 4, (R(s * 13 + b) - 0.5) * (o.straight ? 0.1 : 0.16), 1 + Math.floor(R(s * 17 + b) * 2), o.straight ? 0.6 : 2.5]);
      for (let y = 3; y < S - 3; y++) for (let x = 0; x < W; x++) {
        let acc = [0, 0, 0], wsum = 0;
        for (let k = -8; k <= 8; k++) { const yy = Math.min(S - 4, Math.max(3, y + k)), i = (yy * W + x) * 4, w = ker[k + 8]; acc[0] += src[i] * w; acc[1] += src[i + 1] * w; acc[2] += src[i + 2] * w; wsum += w; }
        const i = (y * W + x) * 4;
        let f = 1;
        if (!isN) for (const [cy, bw, amp, wav, wa] of bc) { const yy = cy + Math.sin(x / W * Math.PI * 2 * wav + cy) * wa; f += amp * Math.exp(-((y - yy) ** 2) / (2 * bw * bw)); }
        for (let ch = 0; ch < 3; ch++) d[i + ch] = Math.min(255, acc[ch] / wsum * f);
      }
      g.putImageData(img, 0, y0);
    }
    tex.needsUpdate = true;
  }
}
export function eraseNails(T) {
  for (const tex of [T.wood, T.woodN]) {
    const g = tex.image.getContext('2d'), band = g.getImageData(212, 0, 26, 768);
    g.putImageData(band, 243, 0);
    tex.needsUpdate = true;
  }
}
