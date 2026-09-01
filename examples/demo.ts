/** The README's first code sample, compiled. `npm run typecheck` includes
 * this file, so the snippet a reader copies is the snippet CI proves. */

import { mountBench, carefulVerify, CAREFUL_TAMPERS } from '@m-sanchez/careful-verifier/bench';
import { parseLedger } from '@m-sanchez/careful-verifier';

const question = 'Who has this account paid most often this quarter?';
const rows = parseLedger('2025-04-01,Alder Logistics\n2025-04-02,Marram Freight');

mountBench(
  document.querySelector<HTMLElement>('#bench')!,
  {
    baseline: {
      subjects: ['acct-1187'],
      sources: ['payments'],
      window: { from: '2025-04-01', to: '2025-07-04', origin: 'stated' },
      asks: [
        {
          kind: 'ranking',
          direction: 'most',
          sourceSpan: question,
          resolution: { state: 'resolved' }
        }
      ],
      unclaimedText: []
    },
    verify: carefulVerify(question, rows),
    tampers: CAREFUL_TAMPERS
  },
  { title: 'your turn: try to trick it' }
);
