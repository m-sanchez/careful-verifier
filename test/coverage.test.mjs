import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractLedgerCsv, parseLedger, computeRead, runCareful } from '../src/verifier.mjs';

/** Coverage is the guarantee this package is named for: a claim may only
 * carry the coverage it can support. That is only true if coverage is a
 * record the caller declares, not an inference from however many rows the
 * caller happened to hand over. The fixture below is the repo's own `cap`
 * case: the 500 rows that read actually touched. */

const cases = JSON.parse(readFileSync(new URL('../data/cases.json', import.meta.url), 'utf8'));
const capCase = cases.find((c) => c.id === 'cap');
const capRows = parseLedger(extractLedgerCsv(capCase.run.fused.exchange.request.userMessage));
const capDraft = () => JSON.parse(capCase.run.interp.attempts[0].rawDraft);
const QUESTION = capCase.question;

test('a partial read declared as partial is stamped partial', () => {
  const result = runCareful(QUESTION, capDraft(), capRows, {
    read: { populationCount: capCase.run.careful.coverage.populationCount }
  });
  assert.deepEqual(result.coverage, {
    itemsRead: 500,
    populationCount: 1310,
    complete: false,
    capApplied: true
  });
  assert.equal(result.disposition.disposition, 'degraded');
  const unqualified = result.claimsLedger.find((c) => c.coverageClaimed === 'complete');
  assert.equal(unqualified.outcome, 'struck');
});

test('computeRead carries a declared population larger than the rows handed in', () => {
  const read = computeRead(capRows, { from: '2025-04-01', to: '2025-07-04' }, null, {
    populationCount: 1310
  });
  assert.equal(read.itemsRead, 500);
  assert.equal(read.populationCount, 1310);
  assert.equal(read.complete, false);
});

test('a declared population below the rows read is refused, not quietly repaired', () => {
  assert.throws(
    () => computeRead(capRows, { from: '2025-04-01', to: '2025-07-04' }, null, { populationCount: 3 }),
    /populationCount/
  );
});

test('the registry record never claims an operation the run then cannot execute', () => {
  const d = capDraft();
  d.asks = d.asks.filter((a) => a.kind === 'presence');
  const result = runCareful(QUESTION, d, capRows);
  const registry = result.checkpoints.find((k) => k.station === 'REGISTRY');
  assert.equal(result.disposition.disposition, 'cannot-execute');
  assert.notEqual(registry.status, 'pass');
  assert.doesNotMatch(registry.detail, /every ask has a registered operation/);
});
