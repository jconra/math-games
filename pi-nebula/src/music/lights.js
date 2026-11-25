// THE LIGHT BARS: a row of glowing strips (a hallway's) that answer the music, from the tap's pulse numbers
// (src/music/tap.js PULSES). The game's maker, 2026-11-24: "It seems like it would be cool to have some light bars or
// something that respond the the music that are in the hallways or something. But I don't know if that would be a
// performance hit. Maybe it could be an option."
//
// Each strip is one brightness, 0..1: in the game that is one number put on the strip's glowing material (its
// emissive intensity), no real light cast, so a hallway of them costs about what working the numbers out costs (the
// Music Lab's notes, VISUALS_1.md: measured).
//
//   LIGHT_STYLES   [{ id, label }]
//     beat    all the strips pulse together on the kick, a low glow with the bass between
//     run     a light running along the hallway a strip a step (sixteen a bar), brighter on the kick
//     meter   the strips as a level meter from the middle out: how loud the music is, the kick pushing it
//   lightBars(pulse, n, style, out?) -> Float32Array(n) of brightnesses 0..1 (out reused if given)
//   LIGHT_COLOURS  each style's colour (the strip's material colour)
export const LIGHT_STYLES = [
  { id: 'beat', label: 'Pulse on the beat' },
  { id: 'run', label: 'Running light' },
  { id: 'meter', label: 'Level meter' },
];
export const LIGHT_COLOURS = { beat: '#8fd3ff', run: '#7dffc8', meter: '#ffd27a' };

export function lightBars(pulse, n, style = 'beat', out = null) {
  const b = out && out.length === n ? out : new Float32Array(n);
  const k = pulse ? pulse.kick : 0, bass = pulse ? pulse.bass : 0, level = pulse ? pulse.level : 0;
  if (style === 'run') {
    // the head moves one strip a step; a new light every 8 strips, each with a tail behind it
    const head = (pulse ? pulse.barPhase : 0) * 16, gap = 8;
    for (let i = 0; i < n; i++) {
      const d = (((head - i) % gap) + gap) % gap;           // how far behind a head this strip is (0..gap)
      const tail = d < 1 ? 1 - d * 0.2 : Math.max(0, 0.8 - (d - 1) * 0.28);
      b[i] = pulse && (pulse.busy.beat || pulse.on.bass || level) ? Math.min(1, 0.06 + tail * (0.55 + 0.45 * k)) : 0.06;
    }
  } else if (style === 'meter') {
    const v = Math.min(1, level * 0.8 + k * 0.35), mid = (n - 1) / 2;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(i - mid) / (mid + 0.5);               // 0 middle .. 1 the ends
      b[i] = d < v ? 0.45 + 0.55 * (1 - d / Math.max(v, 1e-3)) : 0.05;
    }
  } else {
    const v = 0.08 + 0.22 * bass + 0.7 * k;
    for (let i = 0; i < n; i++) b[i] = Math.min(1, v);
  }
  return b;
}
