import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';
import { extractLedgerCsv, parseLedger, runCareful, DEPLOYMENT } from '../src/verifier.mjs';

/** The headline claims, enforced. CLAIMS.md maps every falsifiable line of
 * the README and the package description to a test; these are the ones
 * with nowhere else to live. */

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('zero runtime dependencies, as the badge and the description say', () => {
  assert.deepEqual(pkg.dependencies ?? {}, {});
  assert.deepEqual(pkg.peerDependencies ?? {}, {});
  assert.deepEqual(pkg.optionalDependencies ?? {}, {});
});

test('nothing shipped makes a network call - no model calls, and none of any other kind', () => {
  const dir = fileURLToPath(new URL('../dist/bench/', import.meta.url));
  const shipped = [
    fileURLToPath(new URL('../src/verifier.mjs', import.meta.url)),
    ...readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => dir + f)
  ];
  assert.ok(shipped.length >= 5, 'the built bench is present');
  for (const file of shipped) {
    const source = readFileSync(file, 'utf8');
    for (const banned of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon']) {
      assert.ok(!source.includes(banned), `${banned} in ${file}`);
    }
  }
});

const cases = JSON.parse(readFileSync(new URL('../data/cases.json', import.meta.url), 'utf8'));
const plain = cases.find((c) => c.id === 'plain');
const ROWS = parseLedger(extractLedgerCsv(plain.run.fused.exchange.request.userMessage));
const QUESTION = plain.question;
const draft = () => JSON.parse(plain.run.interp.attempts[0].rawDraft);

const widened = () => {
  const d = draft();
  d.subjects = [...d.subjects, 'acct-2044'];
  return d;
};
const leastAsk = () => {
  const d = draft();
  d.asks[0].direction = 'least';
  return d;
};

const SCENARIOS = [
  ['clean', () => runCareful(QUESTION, draft(), ROWS)],
  ['capped', () => runCareful(QUESTION, draft(), ROWS, { cap: DEPLOYMENT.cap })],
  ['declared partial', () => runCareful(QUESTION, draft(), ROWS, { read: { populationCount: 99999 } })],
  ['forged count', () => runCareful(QUESTION, draft(), ROWS, { forgedCount: 999 })],
  ['forged over a capped read', () => runCareful(QUESTION, draft(), ROWS, { cap: 500, forgedCount: 999 })],
  ['unregistered ask', () => runCareful(QUESTION, leastAsk(), ROWS)],
  ['out of scope', () => runCareful(QUESTION, widened(), ROWS)],
  ['hostile', () => runCareful(cases.find((c) => c.id === 'hostile').question, JSON.parse(cases.find((c) => c.id === 'hostile').run.interp.attempts[0].rawDraft), ROWS)]
];

test('only certified claims can appear in the answer', () => {
  for (const [name, run] of SCENARIOS) {
    const result = run();
    const certified = result.claimsLedger.filter((c) => c.outcome === 'certified');
    const struck = result.claimsLedger.filter((c) => c.outcome === 'struck');
    if (certified.length > 0) {
      assert.equal(result.answer, certified[certified.length - 1].assertion, `${name}: the answer is a certified claim`);
    }
    for (const s of struck) {
      assert.ok(!result.answer.includes(s.assertion), `${name}: struck claim reached the answer`);
    }
    assert.ok(result.disposition.pathToYes.length > 0, `${name}: every disposition carries a path to yes`);
  }
});

test('a struck claim is always struck in writing, with the check that failed', () => {
  for (const [name, run] of SCENARIOS) {
    for (const claim of run().claimsLedger) {
      if (claim.outcome === 'struck') {
        assert.ok(claim.failingCheck && claim.failingCheck.length > 0, `${name}: struck without a failing check`);
      }
    }
  }
});

test('every station that catches something records what it caught', () => {
  for (const [name, run] of SCENARIOS) {
    for (const k of run().checkpoints) {
      if (k.status === 'pass') continue;
      if (k.station === 'ANSWER') {
        // ANSWER does not catch; it restates the disposition and names the
        // way out, which is what the recorded runs put there too
        assert.match(k.detail, /to unlock the rest: /, `${name}: ANSWER detail`);
        continue;
      }
      assert.ok(k.catch, `${name}: ${k.station} is ${k.status} with no catch recorded`);
      for (const field of ['kind', 'artifactText', 'ground', 'gloss']) {
        assert.equal(typeof k.catch[field], 'string', `${name}: ${k.station} catch.${field}`);
      }
    }
  }
});
