import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** The "Node and the browser" claim, proven at the level it can be proven
 * here, and pinned to the ROOT export specifically. The package now also
 * ships a DOM-targeted subpath (./bench, built to dist/), so this guard
 * resolves the root entry out of package.json rather than naming a file:
 * whatever "." points at must keep an empty import graph and no Node
 * globals, so any ES-module environment can load it with no build step.
 * The bench lives behind its own subpath and never leaks in here. */

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const rootEntry = pkg.exports['.'].default;
const rootUrl = new URL(`../${rootEntry.replace(/^\.\//, '')}`, import.meta.url);
const source = readFileSync(rootUrl, 'utf8');

test('the root export is the plain-JS verifier, not the built bench', () => {
  assert.equal(rootEntry, './src/verifier.mjs');
  assert.equal(pkg.exports['./bench'].default, './dist/bench/index.js');
  assert.ok(!/dist\//.test(source), 'the root export does not reach into dist/');
});

test('the root export imports nothing at all', () => {
  assert.ok(!/^\s*import\s/m.test(source), 'no static imports');
  assert.ok(!/\bimport\s*\(/.test(source), 'no dynamic imports');
  assert.ok(!/\brequire\s*\(/.test(source), 'no CommonJS requires');
});

test('the root export touches no Node globals', () => {
  for (const banned of ['process.', 'globalThis.fs', 'Buffer.', '__dirname', '__filename']) {
    assert.ok(!source.includes(banned), `no ${banned}`);
  }
});

test('the root export touches no DOM globals either', () => {
  // matched as globals, not as property names. `window` is deliberately not
  // on this list: here it is the domain's own word for a date range, bound
  // as a parameter of computeRead, and the data: URL run below is what
  // actually proves nothing DOM-shaped is reached for.
  for (const banned of ['document', 'navigator', 'localStorage', 'HTMLElement', 'customElements']) {
    assert.ok(!new RegExp(String.raw`(^|[^.\w$])${banned}\b`).test(source), `no global ${banned}`);
  }
});

test('the root export loads and runs from a data: URL, as a browser would load it', async () => {
  const mod = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const verdict = mod.validateDraft({ bad: true }, 'question?');
  assert.equal(verdict.verdict, 'rejected');
});
