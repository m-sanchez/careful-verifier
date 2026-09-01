import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** CLAIMS.md maps every falsifiable claim to the test that enforces it. A
 * map nobody checks rots into decoration, so this checks it: every
 * `file::test name` it cites must name a test that exists, and every test
 * file in the suite must be cited at least once. Renaming a test without
 * updating the map fails here. */

const root = new URL('../', import.meta.url);
const claims = readFileSync(new URL('CLAIMS.md', root), 'utf8');
const testDir = fileURLToPath(new URL('test/', root));
const testFiles = readdirSync(testDir).filter((f) => f.endsWith('.test.mjs'));

/** `` `test/x.test.mjs::some test name` `` inside a backtick span. */
const cited = [...claims.matchAll(/`(test\/[\w.-]+\.test\.mjs)::([^`]+)`/g)].map((m) => ({
  file: m[1],
  name: m[2]
}));

test('CLAIMS.md cites tests at all', () => {
  assert.ok(cited.length >= 40, `only ${cited.length} citations found`);
});

test('every test CLAIMS.md cites exists, spelled the way the source spells it', () => {
  const sources = new Map();
  for (const { file, name } of cited) {
    const base = file.slice('test/'.length);
    assert.ok(testFiles.includes(base), `CLAIMS.md cites ${file}, which is not in the suite`);
    if (!sources.has(base)) sources.set(base, readFileSync(testDir + base, 'utf8'));
    const source = sources.get(base);
    assert.ok(source.includes(name), `${file} has no test named: ${name}`);
  }
});

test('every test file in the suite is cited by CLAIMS.md', () => {
  const citedFiles = new Set(cited.map((c) => c.file.slice('test/'.length)));
  // this file maps the map; types-smoke is compiled, not run
  citedFiles.add('claims-map.test.mjs');
  for (const file of testFiles) {
    assert.ok(citedFiles.has(file) || claims.includes(file), `test/${file} is enforcing nothing CLAIMS.md admits to`);
  }
});

test('the CI steps CLAIMS.md leans on are the steps the workflow declares', () => {
  const workflow = readFileSync(new URL('.github/workflows/test.yml', root), 'utf8');
  assert.match(workflow, /node: \[18, 22, 24\]/);
  for (const step of ['install proof', 'the packed bench mounts and catches, in a DOM']) {
    assert.ok(claims.includes(step), `CLAIMS.md cites no step "${step}"`);
    assert.ok(workflow.includes(step), `the workflow has no step "${step}"`);
  }
});
