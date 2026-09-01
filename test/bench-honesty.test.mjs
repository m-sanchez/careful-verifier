import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { Bench, mountBench } from '../dist/bench/index.js';

/** Four ways the widget used to lie to the visitor, in the exact flow it
 * exists for. A bench about provenance may not lose an edit, may not
 * invent one, and may not die on the hostile input it invites. */

const countVerify = (d) => ({
  checkpoints: [
    d.count === 1
      ? { label: 'count', status: 'pass' }
      : { label: 'count', status: 'warn', detail: `claimed ${d.count}, counted 1` }
  ],
  outcome: d.count === 1 ? 'clean' : 'caught'
});

function mount(config, opts) {
  const window = new Window();
  const container = window.document.createElement('div');
  window.document.body.appendChild(container);
  const mounted = mountBench(container, config, opts);
  const q = (sel) => container.querySelector(sel);
  return { container, mounted, q, text: (sel) => q(sel)?.textContent ?? '' };
}

const forgeConfig = () => ({
  baseline: { count: 1 },
  verify: countVerify,
  tampers: [{ id: 'forge', label: 'forge the count', apply: (d) => ({ ...d, count: 9 }) }]
});

test('a hand edit is absorbed by a chip click, not destroyed by it', () => {
  const { mounted, q } = mount(forgeConfig());
  q('.tb-editor').value = JSON.stringify({ count: 42 });
  q('[data-tamper="forge"]').click();
  assert.deepEqual(mounted.bench.appliedTampers, ['hand-edit', 'forge']);
  assert.equal(mounted.bench.draft.count, 9);
});

test('a chip refuses on unparseable text instead of silently discarding it', () => {
  const { mounted, q, text } = mount(forgeConfig());
  q('.tb-editor').value = '{not json';
  q('[data-tamper="forge"]').click();
  assert.match(text('.tb-status'), /not valid JSON/);
  assert.deepEqual(mounted.bench.appliedTampers, []);
  assert.equal(q('.tb-editor').value, '{not json', 'the visitor keeps what they typed');
});

test('a verifier returning a report with no checkpoints is contained, not fatal', () => {
  const { mounted, q, container } = mount({
    baseline: { count: 1 },
    verify: () => ({ outcome: 'looks fine to me' }),
    tampers: []
  });
  q('.tb-run').click();
  const items = container.querySelectorAll('.tb-checkpoint');
  assert.equal(items.length, 1);
  assert.match(items[0].textContent, /stop/);
  assert.match(items[0].textContent, /checkpoints/);
  assert.equal(mounted.bench.history.length, 1);
});

test('the core normalises a malformed report the same way it contains a throw', () => {
  const entry = new Bench({ baseline: { a: 1 }, verify: () => 'not a report at all', tampers: [] }).run();
  assert.equal(entry.report.checkpoints[0].status, 'stop');
  assert.match(entry.report.outcome, /finding too/);
});

test('a draft that is not plain JSON is not recorded as a hand edit on every clean run', () => {
  const { mounted, q } = mount({
    baseline: { at: new Date('2025-01-01T00:00:00.000Z'), count: 1 },
    verify: countVerify,
    tampers: []
  });
  q('.tb-run').click();
  assert.deepEqual(mounted.bench.appliedTampers, [], 'an untouched baseline is not an edit');
  assert.equal(mounted.bench.history[0].report.outcome, 'clean');
});

test('the attempt log is rendered, so a visitor sees what they tried', () => {
  const { q, container } = mount(forgeConfig());
  q('.tb-run').click();
  q('[data-tamper="forge"]').click();
  q('.tb-run').click();
  q('.tb-editor').value = JSON.stringify({ count: 77 });
  q('.tb-run').click();
  const rows = Array.from(container.querySelectorAll('.tb-log li')).map((li) => li.textContent);
  assert.equal(rows.length, 3);
  assert.match(rows[0], /forge \+ hand-edit/);
  assert.match(rows[1], /^forge/);
  assert.match(rows[2], /^baseline/);
  assert.match(q('.tb-log-summary').textContent, /3 attempts, 2 caught/);
});
