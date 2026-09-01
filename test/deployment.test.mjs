import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractLedgerCsv, parseLedger, runCareful } from '../src/verifier.mjs';
import { SUPPORT_DESK, SUPPORT_QUESTION, SUPPORT_CSV, supportDraft } from './fixtures/support-desk.mjs';

/** The package describes itself as a claim verifier, not as one recorded
 * payments scenario. That is only true if the deployment - the grant, the
 * registry, the vocabulary the certified claim is written in - is an input.
 * These tests are the evidence. */

const ticketRows = parseLedger(SUPPORT_CSV);

const cases = JSON.parse(readFileSync(new URL('../data/cases.json', import.meta.url), 'utf8'));
const plain = cases.find((c) => c.id === 'plain');
const payRows = parseLedger(extractLedgerCsv(plain.run.fused.exchange.request.userMessage));
const payDraft = () => JSON.parse(plain.run.interp.attempts[0].rawDraft);

test('a second, non-payments deployment runs the same stations end to end', () => {
  const result = runCareful(SUPPORT_QUESTION, supportDraft(), ticketRows, {
    deployment: SUPPORT_DESK
  });
  assert.equal(result.attempt.verdict, 'accepted');
  assert.deepEqual(
    result.checkpoints.map((k) => k.station),
    ['VALIDATOR', 'GATE', 'SCOPE', 'REGISTRY', 'EVIDENCE', 'CLERK', 'ANSWER', 'REPLAY']
  );
  assert.ok(result.checkpoints.every((k) => k.status === 'pass'));
  assert.equal(result.disposition.disposition, 'answered');
  assert.equal(result.answer, 'most frequent requester in March: Bramble Dairy (13 tickets)');
  assert.deepEqual(result.coverage, {
    itemsRead: 22,
    populationCount: 22,
    complete: true,
    capApplied: false
  });
});

test('scope refuses against the injected grant, naming it', () => {
  const d = supportDraft();
  d.subjects = ['queue-north', 'queue-south'];
  const result = runCareful(SUPPORT_QUESTION, d, ticketRows, { deployment: SUPPORT_DESK });
  assert.equal(result.disposition.disposition, 'refused');
  const scope = result.checkpoints.at(-1);
  assert.equal(scope.station, 'SCOPE');
  assert.match(scope.catch.artifactText, /queue-south/);
  assert.match(scope.catch.ground, /queue-north/);
  assert.doesNotMatch(result.answer, /acct-1187/);
});

test('the certified claim names the window it actually covers, not a literal period', () => {
  const d = payDraft();
  d.window.from = '2025-01-01';
  const result = runCareful(plain.question, d, payRows);
  assert.equal(result.coverage.populationCount, payRows.length);
  assert.doesNotMatch(result.answer, /this quarter/);
  assert.equal(result.answer, 'most frequent payee 2025-01-01..2025-07-04: Marram Freight (670 payments)');
});

test('a deployment missing its vocabulary is rejected, never repaired', () => {
  const broken = { ...SUPPORT_DESK, vocabulary: undefined };
  assert.throws(() => runCareful(SUPPORT_QUESTION, supportDraft(), ticketRows, { deployment: broken }), /vocabulary/);
});

test('an ask kind outside the injected schema is rejected at the validator', () => {
  const d = supportDraft();
  d.asks = [{ ...d.asks[0], kind: 'total', direction: undefined }];
  const result = runCareful(SUPPORT_QUESTION, d, ticketRows, { deployment: SUPPORT_DESK });
  assert.equal(result.attempt.verdict, 'rejected');
  assert.match(result.attempt.reason, /"total" is not in the schema/);
});
