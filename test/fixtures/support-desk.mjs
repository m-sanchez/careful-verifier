/** A second deployment, deliberately nothing to do with payments: a support
 * desk ranking requesters by ticket count over a month. It exists to prove
 * the pipeline is injectable rather than one recorded payments scenario -
 * same stations, same records, different grant, different vocabulary. */

export const SUPPORT_DESK = {
  clock: '2025-03-31',
  subjects: ['queue-north'],
  sources: ['tickets'],
  askKinds: ['ranking', 'presence'],
  cap: 200,
  window: { from: '2025-03-01', to: '2025-03-31', label: 'in March' },
  ops: [{ kind: 'ranking', direction: 'most', certifies: true, label: 'rank most-frequent' }],
  vocabulary: { entity: 'requester', unit: 'tickets' }
};

export const SUPPORT_QUESTION = 'Which requester opened the most tickets in March?';

/** `internal-transfer` rows are the desk's own smoke tests: recorded, never
 * counted. The last two rows fall outside March and must not reach the count. */
const day = (n) => `2025-03-${String(n).padStart(2, '0')}`;
export const SUPPORT_CSV = [
  ...Array.from({ length: 13 }, (_, i) => `${day(i + 1)},Bramble Dairy`),
  ...Array.from({ length: 6 }, (_, i) => `${day(i + 1)},Kestrel Tooling`),
  ...Array.from({ length: 3 }, (_, i) => `${day(i + 10)},desk-smoke-test,internal-transfer`),
  '2025-02-20,Kestrel Tooling',
  '2025-04-02,Bramble Dairy'
].join('\n');

export const supportDraft = () => ({
  subjects: ['queue-north'],
  sources: ['tickets'],
  window: { from: '2025-03-01', to: '2025-03-31', origin: 'stated' },
  asks: [
    {
      kind: 'ranking',
      direction: 'most',
      sourceSpan: 'Which requester opened the most tickets in March?',
      resolution: { state: 'resolved' }
    }
  ],
  unclaimedText: []
});
