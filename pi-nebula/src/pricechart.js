// THE PRICE CHART: what a tonne of each metal sells for, the one price list (src/jobs/smelter.js CHART), each metal
// with a dot of its own colour. One drawing for the two places that show it: at the side of the screen at the asteroid
// field (src/drillview.js) and beside a question at the smelter's controls (src/jobs/panel.js: an order's `chart`).
// The game's maker (2026-11-18): "I think that there should be a chart to the side that says what each metal sells
// for", and of the smelter's pay questions: "offer the chart of the values of each metal per ton".
//   priceChart(chart) -> the chart's inside, as HTML: its title, small, then a name and a price for each metal.
//     chart: { title, rows: [[name, price], ...] } (smelter.js chartOf: "A tonne sells for", or, a canister holding a
//     tonne, "A canister sells for"); not given: a tonne's.
//   Its box and its two columns are the place's own (.pdr-chart in drillview.js, .pnj-prices in jobs/jobs.css).
import { ORE, chartOf } from './jobs/smelter.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const say = (n) => Math.round(n).toLocaleString('en-US');

export function priceChart(chart = chartOf()) {
  return `<small>${esc(chart.title)}</small>` + chart.rows.map(([name, price]) => `<span><i style="--c: ${(ORE[name] || ORE.copper).glow}"></i>${esc(cap(name))}</span><b>${say(price)}</b>`).join('');
}
// a metal's dot, in its colour (an answer's row: "how much of each metal")
export const metalDot = (name) => `<i style="--c: ${(ORE[name] || ORE.copper).glow}"></i>`;
