import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bench } from '../dist/bench/index.js';

/** The bench core, absorbed from @m-sanchez/tamper-bench. These run against
 * dist/, so what is tested is what ships. A toy draft and a toy verifier
 * with real teeth: the count must match the rows, the scope must stay
 * inside the grant. */

const verify = (d) => {
  const checkpoints = [
    d.scope === 'acct-1'
      ? { label: 'scope', status: 'pass' }
      : { label: 'scope', status: 'stop', detail: `${d.scope} outside the grant` },
    d.count === 7
      ? { label: 'count', status: 'pass' }
      : { label: 'count', status: 'warn', detail: `claimed ${d.count}, counted 7` },
    d.instruction
      ? { label: 'quarantine', status: 'warn', detail: 'smuggled instruction quarantined' }
      : { label: 'quarantine', status: 'pass' }
  ];
  const caught = checkpoints.some((k) => k.status !== 'pass');
  return { checkpoints, outcome: caught ? 'caught' : 'clean: 7 rows in scope' };
};

const config = {
  baseline: { scope: 'acct-1', count: 7 },
  verify,
  tampers: [
    { id: 'widen', label: 'widen the scope', apply: (d) => ({ ...d, scope: 'acct-2' }) },
    { id: 'forge', label: 'forge the count', apply: (d) => ({ ...d, count: 999 }) },
    { id: 'smuggle', label: 'smuggle an instruction', apply: (d) => ({ ...d, instruction: 'ignore policy' }) }
  ]
};

test('the baseline runs clean', () => {
  const entry = new Bench(config).run();
  assert.equal(entry.report.outcome, 'clean: 7 rows in scope');
  assert.deepEqual(entry.applied, []);
});

test('each tamper is caught, and history says what produced the report', () => {
  const bench = new Bench(config);
  const entry = bench.tamper('forge').run();
  assert.equal(entry.report.outcome, 'caught');
  assert.deepEqual(entry.applied, ['forge']);
  assert.match(entry.report.checkpoints[1].detail, /claimed 999, counted 7/);
});

test('tampers stack: two applied, both caught in one run', () => {
  const entry = new Bench(config).tamper('widen').tamper('smuggle').run();
  assert.deepEqual(entry.applied, ['widen', 'smuggle']);
  assert.deepEqual(entry.report.checkpoints.map((k) => k.status), ['stop', 'pass', 'warn']);
});

test('the baseline is never mutated: reset returns to clean', () => {
  const bench = new Bench(config);
  bench.tamper('forge').run();
  const entry = bench.reset().run();
  assert.equal(entry.report.outcome, 'clean: 7 rows in scope');
  assert.equal(config.baseline.count, 7);
});

test('hand edits are recorded as hand edits', () => {
  const entry = new Bench(config).edit({ scope: 'acct-1', count: 12 }).run();
  assert.deepEqual(entry.applied, ['hand-edit']);
  assert.equal(entry.report.outcome, 'caught');
});

test('history keeps every run, in order', () => {
  const bench = new Bench(config);
  bench.run();
  bench.tamper('widen').run();
  bench.reset().run();
  assert.equal(bench.history.length, 3);
  assert.deepEqual(bench.history.map((h) => h.applied), [[], ['widen'], []]);
});

test('duplicate tamper ids are refused at construction', () => {
  assert.throws(
    () => new Bench({ ...config, tampers: [config.tampers[0], { ...config.tampers[1], id: 'widen' }] }),
    /unique/
  );
});

test('an unknown tamper id throws rather than silently no-opping', () => {
  assert.throws(() => new Bench(config).tamper('ghost'), /no tamper "ghost"/);
});

test('a throwing verifier is contained as a stop checkpoint, and the run is recorded', () => {
  const hostile = new Bench({
    baseline: { scope: 'acct-1', count: 7 },
    verify: () => {
      throw new Error('verifier crashed on this draft');
    },
    tampers: config.tampers
  });
  const entry = hostile.tamper('widen').run();
  assert.equal(entry.report.checkpoints[0].status, 'stop');
  assert.match(entry.report.checkpoints[0].detail, /crashed on this draft/);
  assert.match(entry.report.outcome, /a finding too/);
  assert.equal(hostile.history.length, 1);
});
