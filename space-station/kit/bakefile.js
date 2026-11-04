// THE SAVED LIGHT: a station's bake, worked out once (by the lab, on a desktop) and kept beside its room file, so a
// phone loads the light instead of working it out. Like Mathwood's baked land.
//   Each room (zone) and baked material keeps its vertex count and a hash of its vertex positions: if the pieces or
//   their code change, the hash stops matching and that room is baked live instead (nothing breaks, it is just slower).
//   Stored per vertex: the corner darkening (one byte) and the strips' light (three bytes, on a log scale), each as
//   its own run of bytes, each byte the difference from the one before (it packs far smaller), the lot gzipped.
const MAGIC = 'KBK1', MAXB = 24, K = 64, LOGMAX = Math.log2(1 + MAXB * K);

// a hash of a geometry's vertex positions (to the nearest 4 mm) and its vertex count
export function signature(geo) {
  const p = geo.attributes.position.array; let h = 0x811c9dc5 ^ p.length;
  for (let i = 0; i < p.length; i++) h = Math.imul(h ^ (Math.round(p[i] * 256) | 0), 0x01000193);
  return { n: p.length / 3, h: (h >>> 0).toString(36) };
}
const enc = (x) => Math.max(0, Math.min(255, Math.round(255 * Math.log2(1 + Math.min(MAXB, Math.max(0, x)) * K) / LOGMAX)));
const DEC = new Float32Array(256).map((_, u) => (Math.pow(2, u / 255 * LOGMAX) - 1) / K);

async function gzip(bytes, how) {
  const s = new Blob([bytes]).stream().pipeThrough(how === 'pack' ? new CompressionStream('gzip') : new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

// pack the baked zones of a built room: zones = [{ id, meshes: { solid: geo, floor: geo, ... } }]
export async function packBake(zones, info = {}) {
  const head = { v: 1, ...info, zones: {} }, runs = []; let off = 0;
  for (const z of zones) {
    const zh = head.zones[z.id] = {};
    for (const [k, geo] of Object.entries(z.meshes)) {
      const ao = geo.attributes.aAO?.array, bk = geo.attributes.aBake?.array; if (!ao || !bk) continue;
      const n = ao.length, buf = new Uint8Array(n * 4);
      let prev = [0, 0, 0, 0];
      for (let i = 0; i < n; i++) {
        const q = [Math.round(Math.max(0, Math.min(1, ao[i])) * 255), enc(bk[i * 3]), enc(bk[i * 3 + 1]), enc(bk[i * 3 + 2])];
        for (let c = 0; c < 4; c++) { buf[c * n + i] = (q[c] - prev[c]) & 255; prev[c] = q[c]; }
      }
      zh[k] = { ...signature(geo), off }; runs.push(buf); off += buf.length;
    }
  }
  const hj = new TextEncoder().encode(JSON.stringify(head)), out = new Uint8Array(8 + hj.length + off);
  out.set(new TextEncoder().encode(MAGIC), 0); new DataView(out.buffer).setUint32(4, hj.length, true); out.set(hj, 8);
  let o = 8 + hj.length; for (const r of runs) { out.set(r, o); o += r.length; }
  return gzip(out, 'pack');
}

// fetch and open a saved bake (null if there is none)
export async function loadBake(url) {
  let r; try { r = await fetch(url); } catch (e) { return null; }
  if (!r.ok) return null;
  let b = new Uint8Array(await r.arrayBuffer());
  if (b[0] === 0x1f && b[1] === 0x8b) b = await gzip(b, 'unpack');      // (unless the server already unzipped it)
  if (new TextDecoder().decode(b.subarray(0, 4)) !== MAGIC) return null;
  const hl = new DataView(b.buffer, b.byteOffset).getUint32(4, true), head = JSON.parse(new TextDecoder().decode(b.subarray(8, 8 + hl)));
  return { head, data: b.subarray(8 + hl), bytes: r.headers.get('content-length') };
}

// put the saved light on one zone's geometry for material k, if it still matches; returns whether it did
export function applyBake(saved, zoneId, k, geo, THREE) {
  const e = saved?.head?.zones?.[zoneId]?.[k]; if (!e) return false;
  const s = signature(geo); if (s.n !== e.n || s.h !== e.h) return false;
  const n = e.n, d = saved.data.subarray(e.off, e.off + n * 4), ao = new Float32Array(n), bk = new Float32Array(n * 3);
  const prev = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 4; c++) prev[c] = (prev[c] + d[c * n + i]) & 255;
    ao[i] = prev[0] / 255; bk[i * 3] = DEC[prev[1]]; bk[i * 3 + 1] = DEC[prev[2]]; bk[i * 3 + 2] = DEC[prev[3]];
  }
  geo.setAttribute('aAO', new THREE.BufferAttribute(ao, 1)); geo.setAttribute('aBake', new THREE.BufferAttribute(bk, 3));
  return true;
}
