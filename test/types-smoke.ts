/** Compile-only: the hand-written declarations must keep matching the
 * surface the tests and the site actually use. Drift fails typecheck. */
import {
  DEPLOYMENT,
  computeRead,
  extractLedgerCsv,
  parseLedger,
  runCareful,
  validateDraft
} from '../src/verifier.mjs';
import type { Draft, RunResult } from '../src/verifier.mjs';

const rows = parseLedger(extractLedgerCsv('q\n\nPAYMENT DATA:\n2025-01-01,x'));
const read = computeRead(rows, { from: '2025-01-01', to: '2025-02-01' }, DEPLOYMENT.cap);
const draft: Draft = {
  subjects: ['acct-1187'],
  sources: ['payments'],
  window: { from: '2025-01-01', to: '2025-02-01', origin: 'stated' },
  asks: [],
  unclaimedText: []
};
const result: RunResult = runCareful('q', draft, rows);
const v: { verdict: 'accepted' | 'rejected' } = validateDraft(draft, 'q');
void read.top;
void result.claimsLedger;
void v;

// declared coverage: the rows handed in need not be the population
const partial = computeRead(rows, { from: '2025-01-01', to: '2025-02-01' }, null, {
  populationCount: 1310
});
void partial.complete;
void runCareful('q', draft, rows, { read: { itemsRead: 500, populationCount: 1310 } });
void DEPLOYMENT.ops[0].certifies;
void runCareful('q', draft, rows, { standing: 'requester-confirmed' });
