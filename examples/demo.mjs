/** The runnable example, as a module the page loads and the test drives.
 * It imports the built bench from dist/ and the root verifier through the
 * adapter - exactly what an embedder gets - over a tiny synthetic ledger.
 * Open examples/index.html after `npm run build`. */

import { parseLedger } from '../src/verifier.mjs';
import { mountBench, carefulVerify, CAREFUL_TAMPERS } from '../dist/bench/index.js';

export const QUESTION = 'Who has this account paid most often this quarter?';

/** 24 payments across the quarter; two are internal transfers and are
 * recorded but never counted, and one falls outside the window. */
const LEDGER = [
  ...Array.from({ length: 11 }, (_, i) => `2025-04-${String(i + 1).padStart(2, '0')},Marram Freight`),
  ...Array.from({ length: 7 }, (_, i) => `2025-05-${String(i + 1).padStart(2, '0')},Alder Logistics`),
  ...Array.from({ length: 4 }, (_, i) => `2025-06-${String(i + 1).padStart(2, '0')},Hollis Print`),
  '2025-06-10,internal-sweep,internal-transfer',
  '2025-06-11,internal-sweep,internal-transfer',
  '2025-01-15,Quayside Marine'
].join('\n');

export const ROWS = parseLedger(LEDGER);

export const BASELINE = {
  subjects: ['acct-1187'],
  sources: ['payments'],
  window: { from: '2025-04-01', to: '2025-07-04', origin: 'stated' },
  asks: [
    {
      kind: 'ranking',
      direction: 'most',
      sourceSpan: QUESTION,
      resolution: { state: 'resolved' }
    }
  ],
  unclaimedText: []
};

export function mountDemo(container) {
  return mountBench(
    container,
    { baseline: BASELINE, verify: carefulVerify(QUESTION, ROWS), tampers: CAREFUL_TAMPERS },
    { title: 'your turn: try to trick it' }
  );
}

const target = globalThis.document?.querySelector('#bench');
if (target) mountDemo(target);
