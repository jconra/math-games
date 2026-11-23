// THE SHIPPING COMPUTER'S RUN (the job src/jobs/cargo.js joined to the supply run, src/supplyrun.js): the panel's
// `live` (src/jobs/panel.js). Opened, it takes up the run on now, or starts one (the one call that starts a run, for now
// made here: the supply contract that starts it comes with the other station, later); its five questions are the run's,
// each the next step of working it out (cargo.js chainAt: the run's numbers, at the crew member's level, the same every
// time it is opened for that run), counted with the run (run.k, kept with the crew member: leave the desk after two and
// the third is next when they come back). The fifth answered, the run is worked out: the containers' doors open, and the
// end card says what to load where, and that the forklift is parked in its bay beside the desk.
//   const L = cargoLink({ crew, save, supply })   L.now() (for the maker: { k, chain(step) }), L.head(o) (the card's
//   top: the supply run, which question of five), L.right(), L.over() (the end card), L.close()
import { CARDS, chainAt, seeded, PER_BOX } from './cargo.js';
import { startRun, runOf } from '../supplyrun.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const u = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const nameOf = (slot) => '0' + (slot + 1);

// contract: the run is a signed supply contract's, the Loader's own work on it: its cards pay nothing by themselves (the
// share of the run is the pay, as the pilot's cards on a captain's run: src/missions.js THE MONEY)
export function cargoLink({ crew, save = () => {}, supply = null, contract = false }) {
  const run = supply && supply.begin ? supply.begin() : runOf(crew) || startRun(crew);
  if (!Number.isInteger(run.k)) run.k = 0;
  save();
  const chains = new Map();
  // (the run's numbers at a step: the same each time, seeded by the run)
  const chain = (step) => { if (!chains.has(step)) chains.set(step, chainAt(step, run.pallets, seeded(run.n * 7919 + step * 131 + (run.began || 0) % 100000))); return chains.get(step); };
  const dots = () => Array.from({ length: CARDS }, (_, i) => `<i class="${i < run.k ? 'is-done' : i === run.k ? 'is-now' : ''}"></i>`).join('');
  function head(o, end = false) {
    const sub = end ? 'Worked out' : `To ${'the old station'} · question ${Math.min(CARDS, run.k + 1)} of ${CARDS}`;
    return `<header class="pnj-cardtop is-slip"><span class="pnj-icon is-bar" aria-hidden="true"></span><b>Supply run</b><small>${esc(sub)}</small></header>
      <div class="pcc-steps" role="img" aria-label="${Math.min(run.k, CARDS)} of ${CARDS} worked out">${dots()}</div>`;
  }
  const L = {
    ...(contract ? { pay: false } : {}),
    now: () => ({ k: run.k, N: run.pallets, chain }),
    head: (o) => head(o),
    right() { run.k = Math.min(CARDS, run.k + 1); if (run.k >= CARDS && supply) supply.worked(); save(); },
    wrong() {},
    // the end card: worked out, what to load where (and how far the loading has got, opened again later)
    over() {
      if (run.k < CARDS && !run.worked) return null;
      const S = supply ? supply.status() : null, loaded = S ? S.loaded : run.loaded || 0, N = run.pallets, K = Math.ceil(N / PER_BOX);
      const boxes = (run.slots || []).map(nameOf), where = boxes.length > 1 ? `containers ${boxes.slice(0, -1).join(', ')} and ${boxes[boxes.length - 1]}` : `container ${boxes[0]}`;
      const done = run.done || (S && S.left === 0);
      // (Cargo's crew's run, the supply contract signed without the Loader's job: nothing here is the crew member's)
      if (run.byCrew && !done) return { html: `${head(null, true)}
        <p class="pnj-story pcc-end"><b>Cargo's crew loads this run.</b></p>
        <p class="pnj-story pcc-end2">${u(N, 'pallet', 'pallets')} for the old station, in ${where}. The Hauler will be ready for takeoff: up the lift to the main deck, out across the bridge and aboard.</p>`, buttons: [{ label: 'Done' }] };
      const html = `${head(null, true)}
        <p class="pnj-story pcc-end"><b>${done ? 'Loaded!' : `Pack ${u(N, 'pallet', 'pallets')} for the old station.`}</b></p>
        <p class="pnj-story pcc-end2">${done ? 'The Hauler is loaded and ready for takeoff.'
    : `${K === 1 ? 'They go' : `${PER_BOX} to a container, they go`} in ${where}: ${K === 1 ? 'its doors are' : 'their doors are'} open now. Take the forklift, parked in its bay beside this desk, and load the pallets waiting on the loading floor.${loaded ? ` ${loaded} of ${N} loaded so far.` : ''}`}</p>`;
      return { html, buttons: [{ label: 'Done' }] };
    },
    close() {},
  };
  return L;
}
