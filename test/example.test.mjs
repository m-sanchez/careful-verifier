import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import { mountDemo, QUESTION, ROWS, BASELINE } from '../examples/demo.mjs';
import { runCareful } from '../src/verifier.mjs';

/** The shipped example, executed. examples/index.html loads examples/demo.mjs,
 * which imports the built bench out of dist/ and the root verifier through
 * the adapter - so driving mountDemo here runs the same code a visitor's
 * browser runs, not a parallel copy of it. */

const html = readFileSync(new URL('../examples/index.html', import.meta.url), 'utf8');

test('the example page loads the module it ships with, into the container it declares', () => {
  assert.match(html, /<div id="bench"><\/div>/);
  assert.match(html, /<script type="module" src="\.\/demo\.mjs"><\/script>/);
  for (const hook of ['tb-chip', 'tb-editor', 'tb-run', 'tb-rail', 'tb-log', 'tb-stop']) {
    assert.ok(html.includes(hook), `the page styles the ${hook} hook it is handed`);
  }
});

test('the example runs clean, then catches a tamper, in a DOM', () => {
  const window = new Window();
  const container = window.document.createElement('div');
  window.document.body.appendChild(container);
  mountDemo(container);

  container.querySelector('.tb-run').click();
  assert.match(
    container.querySelector('.tb-outcome').textContent,
    /answered: every proposed claim certified/
  );

  container.querySelector('[data-tamper="misquote"]').click();
  container.querySelector('.tb-run').click();
  const rail = Array.from(container.querySelectorAll('.tb-checkpoint')).map((li) => li.textContent);
  assert.deepEqual(rail.length, 1);
  assert.match(rail[0], /VALIDATOR: stop/);
  assert.match(container.querySelector('.tb-log-summary').textContent, /2 attempts, 1 caught/);
  assert.ok(!container.textContent.includes('undefined'));
});

test('the example ledger is one a certified claim can actually be made over', () => {
  const result = runCareful(QUESTION, BASELINE, ROWS);
  assert.equal(result.answer, 'most frequent payee this quarter: Marram Freight (11 payments)');
  assert.deepEqual(result.coverage, {
    itemsRead: 24,
    populationCount: 24,
    complete: true,
    capApplied: false
  });
});
