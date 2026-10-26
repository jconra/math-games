// THE WIND TEST, OFF THE PAGE'S OWN THREAD: the frame calculation for a big tower takes a good part of a second on a
// phone, and the page would freeze while it ran, so it runs here while the page keeps drawing (testrun.js runs it itself
// if a worker can't start). Gets { id, tower }; sends back { id, result }: frame.js windTest's whole answer (the gusts
// to show, what is left standing, its height), which is plain data and posts as it is.
import { windTest } from './frame.js';

onmessage = (e) => {
  postMessage({ id: e.data.id, result: windTest(e.data.tower) });
};
