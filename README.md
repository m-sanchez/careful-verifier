# careful-verifier

![JavaScript](https://img.shields.io/badge/JavaScript-JSDoc_typed-F7DF1E?logo=javascript&logoColor=black)
![Node](https://img.shields.io/badge/node-%3E%3D18-5FA04E?logo=nodedotjs&logoColor=white)
![Browser](https://img.shields.io/badge/browser-no_framework-6E6E6E)
![Dependencies](https://img.shields.io/badge/dependencies-0-B45309)
[![CI](https://github.com/m-sanchez/careful-verifier/actions/workflows/test.yml/badge.svg)](https://github.com/m-sanchez/careful-verifier/actions/workflows/test.yml)
![License](https://img.shields.io/badge/license-MIT-6E6E6E)
[![npm](https://img.shields.io/npm/v/@m-sanchez/careful-verifier?color=CB3837&logo=npm&logoColor=white)](https://www.npmjs.com/package/@m-sanchez/careful-verifier)

> **In plain English:** a referee that re-checks an AI's work with plain rules
> and no AI involved, so the checker cannot be fooled the same way the model
> was — plus a widget that lets anyone try to fool it, in their own browser.

Models propose, code certifies. A zero-dependency claim verifier for Node and
the browser, and the tamper bench that renders it. No model calls, no network
calls of any kind.

[Live tamper bench](https://miguelsanchez.co.uk/careful-machine) ·
[Reference implementation](https://github.com/m-sanchez/careful-machine-reference) ·
[More tools](https://github.com/m-sanchez)

*Provenance: this came out of one body of production LLM work, extracted and
generalised into a standalone package. First published 2026-08-31.*

This is the deterministic side of the careful-machine pattern, extracted as a
library. A model may draft a *reading* of a question; this code decides what
that draft is allowed to become. Every draft passes through a station
pipeline (VALIDATOR → GATE → SCOPE → REGISTRY → EVIDENCE → CLERK → ANSWER →
REPLAY) and comes out the other side as checkpoints, a coverage record, a
claims ledger (certified or struck, in writing), and a disposition with a
path to yes. Refusal is a routed outcome, not a failure.

Two entry points, deliberately unlike each other:

| Export | What it is |
| :-- | :-- |
| `@m-sanchez/careful-verifier` | the verifier. Plain JS, node 18+, **empty import graph** — no build step, loads from a `data:` URL, no DOM anywhere |
| `@m-sanchez/careful-verifier/bench` | the tamper bench. DOM widget, built ESM in `dist/`, framework-free |

The root export stays austere on purpose: it is the half that has to run
anywhere. The bench is the half that has to run on a page. The guards resolve
the root entry out of `package.json` and fail if a DOM global, an import, or
a network call ever appears in it.

## Install

```bash
npm install @m-sanchez/careful-verifier
```

Zero runtime dependencies. CI packs the tarball, installs it, imports the
root, and mounts the bench from `./bench` in a DOM — so what is proven is
what ships. A git install works too; npm's `prepare` builds `dist/` for you.

## Use: the verifier

```js
import { runCareful, validateDraft, parseLedger } from '@m-sanchez/careful-verifier';

const result = runCareful(question, draft, rows, { cap: 500 });
result.checkpoints;   // each station: pass, warn, or stop - with what it caught
result.claimsLedger;  // every proposed claim: certified or struck, with the failing check
result.coverage;      // what was read vs what exists - partial reads are stamped
result.disposition;   // answered | degraded | cannot-execute | refused | ... + pathToYes
result.answer;        // only certified claims can appear here
```

The stations enforce, in order: reject-never-repair validation (a draft that
misquotes the requester never acquires standing), a gate that routes
ambiguity back instead of guessing, **subjects and sources** as a record the
proposal cannot widen, capability as a registry (honest refusal beats
invented ability), coverage stamped on every read, a claim turnstile the
narrator cannot bypass, and a disposition derived from records only.

### Coverage is declared, not inferred

The one guarantee this package is named for is that a claim may only carry
the coverage it can support. That means the rows you hand in are not silently
treated as the whole population:

```js
// you paginated, sampled, or pre-filtered: say so, and the claim is cut down
runCareful(question, draft, page, { read: { populationCount: 1310 } });
// coverage: { itemsRead: 500, populationCount: 1310, complete: false, capApplied: true }
// the unqualified claim is struck; the "within the examined rows" form is certified
```

Without `read`, the rows handed in *are* the population — which is what the
recorded runs did, and what a caller reading a whole file means. Declaring a
population below the rows counted is refused, not repaired.

### The deployment is an input

`runCareful(question, draft, rows, { deployment })` takes the grant, the
operation registry, the recorded window and the vocabulary its claims are
written in. The default is the recorded payments deployment, so existing
callers are unaffected; `test/fixtures/support-desk.mjs` is a second,
non-payments one — a support desk ranking requesters by ticket count —
running the same eight stations and certifying *"most frequent requester in
March: Bramble Dairy (13 tickets)"*.

The claim wording is derived, not hardcoded: a deployment's word for its own
window ("this quarter") is used only for exactly that window. Widen the
window and the certified claim names the dates instead, so the assertion text
cannot outrun the read.

## Use: the tamper bench

```ts
import { mountBench, carefulVerify, CAREFUL_TAMPERS } from '@m-sanchez/careful-verifier/bench';
import { parseLedger } from '@m-sanchez/careful-verifier';

const question = 'Who has this account paid most often this quarter?';
const rows = parseLedger(csv);

mountBench(
  document.querySelector<HTMLElement>('#bench')!,
  { baseline: draft, verify: carefulVerify(question, rows), tampers: CAREFUL_TAMPERS },
  { title: 'your turn: try to trick it' }
);
```

`examples/demo.ts` is that snippet in full, and `npm run typecheck`
compiles it. `examples/index.html` is the runnable page: it loads `examples/demo.mjs`,
which imports the built bench out of `dist/` — the same code an embedder
runs, driven by a test.

The bench is generic (`verify: (draft) => Report`, any deterministic function
of the draft). `carefulVerify` is the adapter: the bench renders
`{ label, status, detail }`, the verifier records `{ station, status, detail }`
plus a disposition, and those two shapes are *not* interchangeable — plugged
together raw, the rail is unreadable. The adapter lives here, beside both
shapes, so it cannot drift from either.

- Chips stack, and a chip **absorbs** whatever you typed rather than eating it.
- Hand edits are recorded as `hand-edit`; key-order changes and non-JSON
  fields (a `Date`, a `Map`) are not mistaken for edits.
- A verifier that throws **or returns a malformed report** becomes a stop
  checkpoint. The widget invites hostile input; it cannot be killed by it.
- Every attempt is logged with exactly what produced it: *"3 attempts, 2 caught"*.
- Class hooks only (`tb-root`, `tb-chip`, `tb-rail`, `tb-log`, `tb-pass/warn/stop`);
  no styles injected, every button `type="button"`.

### The measured tamper table

`CAREFUL_TAMPERS` ships six tampers, and none ships without a measurement
behind it. Each is run against the bundled verifier over the recorded ledger
and pinned to the station that catches it — misses included.

| Tamper | Caught at | Outcome |
| :-- | :-- | :-- |
| misquote the requester (Cyrillic lookalike in the quoted span) | VALIDATOR · stop | rejected-draft |
| smuggle an instruction (words the requester never wrote) | VALIDATOR · stop | rejected-draft |
| leave the reading ambiguous | GATE · stop | clarification-needed |
| widen the subject | SCOPE · stop | refused |
| ask for something unregistered | REGISTRY · warn | cannot-execute |
| **widen the window** | **nothing refuses it** | answered |

The last row is the honest one. No station refuses a widened window: the read
recomputes over it, and what stops the widening laundering is that the
certified claim has to name the window it covers
(`most frequent payee 1970-01-01..2025-07-04: ...`), not the deployment's
narrower word for it. Two obvious further tampers — number-drift and
citation-swap — are **not** shipped: this draft shape carries no proposed
number and no citations, so there would be nothing to measure them against,
and a tamper with no measurement behind it proves nothing.

## Develop

```bash
npm ci            # dev-only: typescript, happy-dom
npm run build     # dist/bench
npm test
npm run typecheck
```

The verifier is plain JS with JSDoc types (`src/verifier.d.mts` carries the
declarations, and a compile-only smoke pins them to the real surface). The
bench is TypeScript compiled to `dist/`; its tests import `dist/`, not the
sources, so what is tested is what ships.

## The tests are the point

`test/parity.test.mjs` replays **all five** recorded live runs in
`data/cases.json` — a real model answering the same question through this
pipeline, frozen with the record it produced — and compares the whole
artifact: checkpoint rail, coverage stamp, claims ledger, disposition.

| Test | Claim |
| :-- | :-- |
| all five recorded runs replay exactly | the arithmetic and the record are pinned to real runs, not to themselves |
| misquoted sourceSpan rejected, never repaired | validation rejects; repair would launder the misquote |
| hostile draft stops at the gate | the smuggled instruction is quarantined, not executed |
| out-of-grant subject dies at scope | nothing is read; authority is a record |
| least-frequent ask lands cannot-execute | capability is a record; no invented ability |
| forged count struck at the clerk | the loop's own count ships, the forgery dies in writing |
| a declared partial read degrades honestly | claims may only carry the coverage they can support |
| a second, non-payments deployment runs end to end | this is a library, not one recorded scenario |
| the root export imports nothing and loads from a `data:` URL | it runs in any ES-module environment, no build step |
| a tampered draft renders the rail in a DOM | the two halves actually compose |
| every bundled tamper lands where the table says | the tamper table is measured, not asserted |

[CLAIMS.md](CLAIMS.md) maps every falsifiable claim on this page, and in the
package description, to the test that enforces it.

All identifiers and numbers in the fixture data are synthetic and
illustrative.
