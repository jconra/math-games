// THE BRIDGE TEST, OFF THE PAGE'S OWN THREAD: the sums for a big bridge take a second or more on a phone, so they run
// here while the page keeps drawing (crossing.js runs them itself if a worker can't start). Gets { id, bridge }; sends
// back { id, part } for each part as soon as it is worked out (the bridge under its own weight, then each load's
// crossing), then { id, done: result }: frame.js crossTest's whole answer, plain data.
import { crossTest } from './frame.js';

onmessage = (e) => {
  const { id, bridge } = e.data;
  const result = crossTest(bridge, { onPart: (part) => postMessage({ id, part }) });
  postMessage({ id, done: result });
};
