import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEPLOYMENT,
  extractLedgerCsv,
  parseLedger,
  computeRead,
  runCareful
} from '../src/verifier.mjs';

/** The parity table. data/cases.json is a real model answering the same
 * question through this pipeline five times, frozen with the record the
 * careful machine produced. Every one of those five records is replayed
 * here against the library: the checkpoint rail, the coverage stamp, the
 * claims ledger and the disposition must come out identical, or the
 * library has drifted from its own ground truth.
 *
 * Which rows the careful side read is itself recorded. All five cases share
 * one ledger; a case's *fused* request carries only what the fused machine
 * fetched, which for the capped cases is its own unrecorded page of 500 -
 * a different 500 rows from the ones the careful read touched. The test
 * below pins that difference before using the full ledger, so the choice of
 * corpus is checked rather than assumed. */

const cases = JSON.parse(readFileSync(new URL('../data/cases.json', import.meta.url), 'utf8'));
const byId = (id) => cases.find((c) => c.id === id);
const rowsOf = (c) => parseLedger(extractLedgerCsv(c.run.fused.exchange.request.userMessage));
const LEDGER = rowsOf(byId('plain'));
const WINDOW = { from: '2025-04-01', to: '2025-07-04' };

test('the recorded ledger is one file, and the capped cases were served a different page of it', () => {
  assert.equal(LEDGER.length, byId('plain').run.key.rowsTotal);
  for (const id of ['hostile', 'least']) {
    assert.deepEqual(rowsOf(byId(id)), LEDGER, `${id} was answered over the same ledger`);
  }
  const capCase = byId('cap');
  const fusedPage = rowsOf(capCase);
  assert.equal(fusedPage.length, 500);
  // what the fused machine saw, per run.why.fusedRead
  assert.deepEqual(
    computeRead(fusedPage, WINDOW).counts.slice(0, 2).map((c) => ({ name: c.name, n: c.n })),
    capCase.run.why.fusedRead.bars
  );
  // what the careful read touched, per run.why.carefulRead: the same file, capped
  assert.deepEqual(
    computeRead(LEDGER, WINDOW, DEPLOYMENT.cap).counts.slice(0, 2).map((c) => ({ name: c.name, n: c.n })),
    capCase.run.why.carefulRead.bars
  );
});

/** The recorded answer prose carries two decorations the library does not
 * model, named here rather than left unasserted: the page's own id for a
 * struck claim (pc-4, pc-6), and the requester's words quoted back inside a
 * refusal ("least often"). Everything else is compared verbatim. */
const ANSWER_ALLOWANCE = {
  plain: null,
  hostile: null,
  cap: 'struck-claim id (pc-4) and the path-to-yes tail',
  'confirmed-cap': 'struck-claim id (pc-6) and the path-to-yes tail',
  least: 'the requester\'s words quoted inside the refusal, and the path-to-yes tail'
};

for (const c of cases) {
  test(`recorded run "${c.id}" replays exactly`, () => {
    const draft = JSON.parse(c.run.interp.attempts[0].rawDraft);
    const result = runCareful(c.question, draft, LEDGER, {
      cap: c.cap ? DEPLOYMENT.cap : null,
      standing: c.standing
    });
    const recorded = c.run.careful;
    assert.deepEqual(result.checkpoints, recorded.checkpoints, 'checkpoint rail');
    assert.deepEqual(result.coverage, recorded.coverage, 'coverage stamp');
    assert.deepEqual(result.claimsLedger, recorded.claimsLedger, 'claims ledger');
    assert.deepEqual(result.disposition, recorded.disposition, 'disposition');

    if (ANSWER_ALLOWANCE[c.id] == null) {
      assert.equal(result.answer, recorded.answer, 'answer prose');
    } else {
      // the allowance is bounded: the library's answer must still be the
      // opening of the recorded one, and the recorded tail must be the
      // path to yes this run derived
      const shared = c.id === 'least'
        ? 'declined, not guessed: this build can rank most-frequent only; it has no approved way to establish '
        : result.answer;
      assert.ok(recorded.answer.startsWith(shared), `recorded prose opens with the library's answer (${c.id})`);
      assert.ok(
        recorded.answer.includes(result.disposition.pathToYes),
        `recorded prose ends in the derived path to yes (${c.id})`
      );
    }
  });
}
