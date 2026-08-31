import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** The "Node and the browser" claim, proven at the level it can be proven
 * here: the module's import graph is empty (no node builtins, no bare
 * imports, no dynamic import), so any ES-module environment can load it.
 * This is a static proof plus a load smoke, not a headless-browser run;
 * the live tamper bench at miguelsanchez.co.uk/careful-machine is the
 * in-browser deployment. */

const source = readFileSync(new URL('../src/verifier.mjs', import.meta.url), 'utf8');

test('the verifier imports nothing at all', () => {
  assert.ok(!/^\s*import\s/m.test(source), 'no static imports');
  assert.ok(!/\bimport\s*\(/.test(source), 'no dynamic imports');
  assert.ok(!/\brequire\s*\(/.test(source), 'no CommonJS requires');
});

test('the verifier touches no Node globals', () => {
  for (const banned of ['process.', 'globalThis.fs', 'Buffer.', '__dirname', '__filename']) {
    assert.ok(!source.includes(banned), `no ${banned}`);
  }
});

test('the module loads and runs from a data: URL, as a browser would load it', async () => {
  const mod = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const verdict = mod.validateDraft({ bad: true }, 'question?');
  assert.equal(verdict.verdict, 'rejected');
});
