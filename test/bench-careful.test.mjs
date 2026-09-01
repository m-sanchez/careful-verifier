import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import { extractLedgerCsv, parseLedger, runCareful } from '../src/verifier.mjs';
import { mountBench, carefulVerify, toBenchReport, CAREFUL_TAMPERS } from '../dist/bench/index.js';

/** The two halves of this package, wired together and executed. The bench
 * renders {label, status, detail}; the verifier records {station, status,
 * detail} and a disposition. They are not interchangeable - plugged in
 * unchanged the rail is unreadable - so the adapter is what makes the
 * claim that these compose true, and this file is the evidence. */

const cases = JSON.parse(readFileSync(new URL('../data/cases.json', import.meta.url), 'utf8'));
const plain = cases.find((c) => c.id === 'plain');
const ROWS = parseLedger(extractLedgerCsv(plain.run.fused.exchange.request.userMessage));
const QUESTION = plain.question;
const baseline = () => JSON.parse(plain.run.interp.attempts[0].rawDraft);
const verify = carefulVerify(QUESTION, ROWS);

function mount(config) {
  const window = new Window();
  const container = window.document.createElement('div');
  window.document.body.appendChild(container);
  mountBench(container, { baseline: baseline(), verify, tampers: CAREFUL_TAMPERS, ...config });
  return container;
}

test('a tampered draft renders the verifier’s own rail, end to end in a DOM', () => {
  const container = mount({});
  container.querySelector('[data-tamper="widen-subject"]').click();
  container.querySelector('.tb-run').click();
  const rail = Array.from(container.querySelectorAll('.tb-checkpoint')).map((li) => li.textContent);
  assert.ok(rail.some((line) => line.includes('SCOPE: stop')), `rail was ${JSON.stringify(rail)}`);
  assert.ok(!container.textContent.includes('undefined'), 'nothing on the page reads "undefined"');
  assert.match(container.querySelector('.tb-outcome').textContent, /refused at scope/);
  assert.match(container.querySelector('.tb-log-summary').textContent, /1 attempt, 1 caught/);
});

test('the raw run record is not a bench report, and the bench says so rather than rendering it', () => {
  const container = mount({ verify: (d) => runCareful(QUESTION, d, ROWS) });
  container.querySelector('.tb-run').click();
  const rail = Array.from(container.querySelectorAll('.tb-checkpoint')).map((li) => li.textContent);
  assert.deepEqual(rail, ['verifier: stop (checkpoint 0 has no label)']);
  assert.ok(!container.textContent.includes('undefined'));
});

test('the adapter maps stations to labels and synthesises an outcome from the disposition', () => {
  const result = runCareful(QUESTION, baseline(), ROWS, { cap: 500 });
  const report = toBenchReport(result);
  assert.deepEqual(
    report.checkpoints.map((k) => k.label),
    result.checkpoints.map((k) => k.station)
  );
  assert.deepEqual(
    report.checkpoints.map((k) => k.status),
    result.checkpoints.map((k) => k.status)
  );
  assert.equal(report.outcome, 'degraded: the claim was cut down to the coverage it can support · to unlock it: run the full read');
  assert.equal(toBenchReport(runCareful(QUESTION, baseline(), ROWS)).outcome, 'answered: every proposed claim certified');
});

/** The measured table. Every bundled tamper is run against the bundled
 * verifier over the recorded ledger, and the row records what actually
 * happened - including the one nothing refuses. A tamper with no
 * measurement against it proves nothing, so none ships without a row here,
 * and the README publishes this table as measured, misses included. */
const MEASURED = {
  misquote: { station: 'VALIDATOR', status: 'stop', disposition: 'rejected-draft' },
  'widen-subject': { station: 'SCOPE', status: 'stop', disposition: 'refused' },
  smuggle: { station: 'VALIDATOR', status: 'stop', disposition: 'rejected-draft' },
  unresolved: { station: 'GATE', status: 'stop', disposition: 'clarification-needed' },
  unregistered: { station: 'REGISTRY', status: 'warn', disposition: 'cannot-execute' },
  // the miss, stated as one: no station refuses a widened window. What stops
  // it laundering is that the certified claim has to name the window it
  // actually covers, so the words cannot outrun the read.
  'widen-window': { station: null, status: 'pass', disposition: 'answered' }
};

test('every bundled tamper ships with the measurement behind it', () => {
  assert.deepEqual(CAREFUL_TAMPERS.map((t) => t.id).sort(), Object.keys(MEASURED).sort());
});

for (const tamper of CAREFUL_TAMPERS) {
  test(`tamper "${tamper.id}" lands exactly where the table says`, () => {
    const draft = tamper.apply(structuredClone(baseline()));
    const result = runCareful(QUESTION, draft, ROWS);
    const expected = MEASURED[tamper.id];
    assert.equal(result.disposition.disposition, expected.disposition);
    const caught = result.checkpoints.filter((k) => k.status !== 'pass');
    if (expected.station == null) {
      assert.deepEqual(caught, [], 'the table calls this one a miss');
      assert.equal(result.answer, 'most frequent payee 1970-01-01..2025-07-04: Marram Freight (670 payments)');
    } else {
      assert.equal(caught[0].station, expected.station);
      assert.equal(caught[0].status, expected.status);
    }
  });
}

test('the baseline the bench ships with runs clean, or the table means nothing', () => {
  const result = runCareful(QUESTION, baseline(), ROWS);
  assert.equal(result.disposition.disposition, 'answered');
  assert.ok(result.checkpoints.every((k) => k.status === 'pass'));
});
