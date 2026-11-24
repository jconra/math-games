// THE SHIPPING COMPUTER'S RUN (the job src/jobs/cargo.js joined to the supply run, src/supplyrun.js): the panel's
// `live` (src/jobs/panel.js). Opened, it takes up the run on now, or starts one (the one call that starts a run, for now
// made here: the supply contract that starts it comes with the other station, later); its five questions are the run's,
// each the next step of working it out (cargo.js chainAt: the run's numbers, at the crew member's level, the same every
// time it is opened for that run), counted with the run (run.k, kept with the crew member: leave the desk after two and
// the third is next when they come back). The fifth answered, the run is worked out: the containers' doors open, and the
// end card says what to load where, and that the forklift is parked in its bay beside the desk.
//   const L = cargoLink({ crew, save, supply })   L.now() (for the maker: { k, chain(step) }), L.head(o) (the card's
//   top: the supply run, which question of five), L.right(), L.over() (the end card), L.close()
//
// A RUN OF THE CREW MEMBER'S OWN, in a Hauler they bought (run.own: src/supplyrun.js contract; the game's maker, BUY1-2:
// "the amount of questions that you are asked should probably go up by about 50% if you take it out yourself"): EIGHT
// QUESTIONS in place of five (src/own.js moreCards). The first five are the same five, working out this load. The other
// three BEGIN THE NEXT LOAD: its crates, its water and its pallets (the second, third and fourth cards of another run's
// chain at the same level, for the same number of people at the old station wherever a card says how many), the
// card's top saying so. They are the same kinds of card, no harder. Answered, the run is worked out as ever.
import { CARDS, chainAt, seeded, PER_BOX } from './cargo.js';
import { startRun, runOf, RUN } from '../supplyrun.js';
import { moreCards } from '../own.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const u = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const nameOf = (slot) => '0' + (slot + 1);

// contract: the run is a signed supply contract's, the Loadmaster's own work on it: its cards pay nothing by themselves (the
// share of the run is the pay, as the pilot's cards on a captain's run: src/missions.js THE MONEY)
export function cargoLink({ crew, save = () => {}, supply = null, contract = false }) {
  const run = supply && supply.begin ? supply.begin() : runOf(crew) || startRun(crew);
  if (!Number.isInteger(run.k)) run.k = 0;
  save();
  const chains = new Map();
  // (the run's numbers at a step: the same each time, seeded by the run)
  const chain = (step) => { if (!chains.has(step)) chains.set(step, chainAt(step, run.pallets, seeded(run.n * 7919 + step * 131 + (run.began || 0) % 100000))); return chains.get(step); };
  // (a run of their own: how many questions in all; and the next load's chain at a step: another run's numbers, the
  // other number of pallets first, with as many people as this load's if such a run can be worked out at all)
  const total = run.own ? moreCards(CARDS, 0) : CARDS, nexts = new Map();
  const next = (step) => {
    if (!nexts.has(step)) {
      const first = chain(step), others = [...RUN.pallets.filter((n) => n !== run.pallets), run.pallets];
      let C = null, any = null;
      for (const N of others) for (let i = 0; i < 60 && !C; i++) { const c = chainAt(step, N, seeded(run.n * 104729 + step * 977 + i * 31 + N)); any = any || c; if (c.people === first.people) C = c; }
      nexts.set(step, C || any);
    }
    return nexts.get(step);
  };
  // (the k-th question's card at a step: this load's five, then the next load's crates, water and pallets)
  const cardAt = (step, k) => (k < CARDS ? chain(step).cards[k] : next(step).cards[Math.min(CARDS - 2, 1 + (k - CARDS))]);
  const dots = () => Array.from({ length: total }, (_, i) => `<i class="${i < run.k ? 'is-done' : i === run.k ? 'is-now' : ''}"></i>`).join('');
  function head(o, end = false) {
    const sub = end ? 'Worked out' : `${run.k >= CARDS ? 'The next load' : `To ${'the old station'}`} · question ${Math.min(total, run.k + 1)} of ${total}`;
    return `<header class="pnj-cardtop is-slip"><span class="pnj-icon is-bar" aria-hidden="true"></span><b>Supply run</b><small>${esc(sub)}</small></header>
      <div class="pcc-steps" role="img" aria-label="${Math.min(run.k, total)} of ${total} worked out">${dots()}</div>`;
  }
  const L = {
    ...(contract ? { pay: false } : {}),
    now: () => ({ k: run.k, N: run.pallets, chain, ...(run.own ? { cardAt } : {}) }),
    head: (o) => head(o),
    total,
    right() { run.k = Math.min(total, run.k + 1); if (run.k >= total && supply) supply.worked(); save(); },
    wrong() {},
    // the end card: worked out, what to load where (and how far the loading has got, opened again later)
    over() {
      if (run.k < total && !run.worked) return null;
      const S = supply ? supply.status() : null, loaded = S ? S.loaded : run.loaded || 0, N = run.pallets, K = Math.ceil(N / PER_BOX);
      const boxes = (run.slots || []).map(nameOf), where = boxes.length > 1 ? `containers ${boxes.slice(0, -1).join(', ')} and ${boxes[boxes.length - 1]}` : `container ${boxes[0]}`;
      const done = run.done || (S && S.left === 0);
      // (Cargo's crew's run, the supply contract signed without the Loadmaster's job: nothing here is the crew member's)
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
