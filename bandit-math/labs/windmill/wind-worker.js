// THE WIND TEST, OFF THE PAGE'S OWN THREAD: the frame calculation for a big tower takes a good part of a second on a
// phone, and the page would freeze while it ran, so it runs here while the page keeps drawing (main.js runs it itself
// if a worker can't start). Gets { id, tower }; sends back { id, result, stands } (frame.js windTest and whatStands),
// with each case trimmed to what the page draws and says (the solve's insides stay here).
import { windTest, whatStands } from './frame.js';

const slim = (c) => c && { axis: c.axis, sign: c.sign, mph: c.mph, face: c.face, ok: c.ok, worst: c.worst, levels: c.levels, tops: c.tops, tip: c.tip };

onmessage = (e) => {
  const t = e.data.tower, result = windTest(t), stands = whatStands(t, result);
  postMessage({
    id: e.data.id, stands,
    result: { failedAt: result.failedAt, fail: slim(result.fail), stages: result.stages.map((s) => ({ name: s.name, mph: s.mph, ok: s.ok, worst: slim(s.worst) })) },
  });
};
