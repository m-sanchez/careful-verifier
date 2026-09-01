# CLAIMS

Every externally falsifiable claim this package makes — in `README.md` and in
the `package.json` description — mapped to the executable test that enforces
it. A claim with no test either got one or was narrowed until it was true.

Run everything with `npm test` (which builds `dist/` first) and
`npm run typecheck`.

## Package description

> Models propose, code certifies. Zero-dependency claim verifier plus an
> embeddable tamper bench, for Node and the browser — no model calls.

| Claim | Enforced by |
| :-- | :-- |
| zero-dependency | `test/claims.test.mjs::zero runtime dependencies, as the badge and the description say` |
| code certifies — a claim reaches the answer only if certified | `test/claims.test.mjs::only certified claims can appear in the answer` |
| …and a struck claim dies in writing, with the check that failed | `test/claims.test.mjs::a struck claim is always struck in writing, with the check that failed` |
| claim verifier: it runs under Node | `test/verifier.test.mjs::the recorded accepted draft runs to the recorded answer` |
| …and in a browser | `test/browser-safety.test.mjs::the root export loads and runs from a data: URL, as a browser would load it` |
| embeddable tamper bench | `test/example.test.mjs::the example runs clean, then catches a tamper, in a DOM` |
| no model calls — and no network calls of any kind | `test/claims.test.mjs::nothing shipped makes a network call - no model calls, and none of any other kind` |

## README

### The two entry points

| Claim | Enforced by |
| :-- | :-- |
| the root export is the plain-JS verifier; `./bench` is the built widget | `test/browser-safety.test.mjs::the root export is the plain-JS verifier, not the built bench` |
| the root export has an empty import graph | `test/browser-safety.test.mjs::the root export imports nothing at all` |
| no build step: it loads and runs as an ES module | `test/browser-safety.test.mjs::the root export loads and runs from a data: URL, as a browser would load it` |
| no DOM anywhere in the root export | `test/browser-safety.test.mjs::the root export touches no DOM globals either` |
| no Node globals in the root export either | `test/browser-safety.test.mjs::the root export touches no Node globals` |
| the bench is framework-free — class hooks only, no styles injected | `test/bench-honesty.test.mjs::the host page owns the look: no styles are injected` |

### The station pipeline

| Claim | Enforced by |
| :-- | :-- |
| every draft passes VALIDATOR → GATE → SCOPE → REGISTRY → EVIDENCE → CLERK → ANSWER → REPLAY | `test/deployment.test.mjs::a second, non-payments deployment runs the same stations end to end` |
| reject-never-repair validation: a misquoted span never acquires standing | `test/verifier.test.mjs::a misquoted sourceSpan is rejected, never repaired` |
| a gate that routes ambiguity back instead of guessing | `test/verifier.test.mjs::the recorded hostile draft stops at the gate and quarantines the injection` |
| subjects and sources as a record the proposal cannot widen | `test/verifier.test.mjs::a subject outside the grant dies at scope before anything is read` |
| capability as a registry: honest refusal beats invented ability | `test/verifier.test.mjs::least-frequent ranking is an honest cannot-execute, as recorded` |
| the registry record never asserts an operation the run then cannot execute | `test/coverage.test.mjs::the registry record never claims an operation the run then cannot execute` |
| coverage stamped on every read | `test/verifier.test.mjs::a capped read degrades honestly: unqualified claim struck, qualified form certified` |
| a claim turnstile the narrator cannot bypass | `test/verifier.test.mjs::a forged count is struck at the clerk and the loop's own count ships` |
| a disposition derived from records only, always with a path to yes | `test/claims.test.mjs::only certified claims can appear in the answer` |
| every station that catches something records what it caught | `test/claims.test.mjs::every station that catches something records what it caught` |

### Coverage is declared, not inferred

| Claim | Enforced by |
| :-- | :-- |
| a partial read declared as partial is stamped partial, and the unqualified claim is struck | `test/coverage.test.mjs::a partial read declared as partial is stamped partial` |
| the declared population may exceed the rows handed in | `test/coverage.test.mjs::computeRead carries a declared population larger than the rows handed in` |
| a declared population below the rows counted is refused, not repaired | `test/coverage.test.mjs::a declared population below the rows read is refused, not quietly repaired` |
| without `read`, the rows handed in are the population — as the recorded runs did | `test/verifier.test.mjs::the recorded accepted draft runs to the recorded answer` |

### The deployment is an input

| Claim | Enforced by |
| :-- | :-- |
| a second, non-payments deployment runs the same eight stations end to end | `test/deployment.test.mjs::a second, non-payments deployment runs the same stations end to end` |
| …certifying "most frequent requester in March: Bramble Dairy (13 tickets)" | `test/deployment.test.mjs::a second, non-payments deployment runs the same stations end to end` |
| scope refuses against the injected grant, naming it | `test/deployment.test.mjs::scope refuses against the injected grant, naming it` |
| the injected ask schema is what the validator enforces | `test/deployment.test.mjs::an ask kind outside the injected schema is rejected at the validator` |
| a deployment that cannot say what its claims are about is rejected | `test/deployment.test.mjs::a deployment missing its vocabulary is rejected, never repaired` |
| the default is the recorded payments deployment, so existing callers are unaffected | `test/verifier.test.mjs::the recorded accepted draft runs to the recorded answer` |
| the deployment's word for its window is used only for exactly that window | `test/deployment.test.mjs::the certified claim names the window it actually covers, not a literal period` |
| widen the window and the claim names the dates instead | `test/verifier.test.mjs::a widened window recomputes, and the claim says which window it covers` |

### The tamper bench

| Claim | Enforced by |
| :-- | :-- |
| `carefulVerify` composes the two halves: a tampered draft renders the verifier's rail | `test/bench-careful.test.mjs::a tampered draft renders the verifier’s own rail, end to end in a DOM` |
| the two shapes are not interchangeable without it | `test/bench-careful.test.mjs::the raw run record is not a bench report, and the bench says so rather than rendering it` |
| the adapter maps station→label and synthesises the outcome from the disposition | `test/bench-careful.test.mjs::the adapter maps stations to labels and synthesises an outcome from the disposition` |
| the bench is generic: any deterministic `(draft) => Report` | `test/bench.test.mjs::each tamper is caught, and history says what produced the report` |
| tampers stack | `test/bench.test.mjs::tampers stack: two applied, both caught in one run` |
| a chip absorbs what you typed rather than eating it | `test/bench-honesty.test.mjs::a hand edit is absorbed by a chip click, not destroyed by it` |
| …and refuses on unparseable text instead of discarding it | `test/bench-honesty.test.mjs::a chip refuses on unparseable text instead of silently discarding it` |
| hand edits are recorded as `hand-edit` | `test/bench.test.mjs::hand edits are recorded as hand edits` |
| key-order changes are not edits | `test/bench-dom.test.mjs::reordering JSON keys in the editor is not recorded as a hand edit` |
| a `Date` in the draft is not an edit | `test/bench-honesty.test.mjs::a draft that is not plain JSON is not recorded as a hand edit on every clean run` |
| a `Map` in the draft is not an edit | `test/bench-honesty.test.mjs::a Map in the draft is not a hand edit either` |
| a throwing verifier becomes a stop checkpoint | `test/bench.test.mjs::a throwing verifier is contained as a stop checkpoint, and the run is recorded` |
| a malformed report becomes one too, and cannot kill the page | `test/bench-honesty.test.mjs::a verifier returning a report with no checkpoints is contained, not fatal` |
| unparseable JSON refuses with a message, not a crash | `test/bench-dom.test.mjs::unparseable hand edits refuse to run, with a message, not a crash` |
| every attempt is logged with what produced it: "3 attempts, 2 caught" | `test/bench-honesty.test.mjs::the attempt log is rendered, so a visitor sees what they tried` |
| reset restores the untouched baseline | `test/bench.test.mjs::the baseline is never mutated: reset returns to clean` |
| an unknown tamper id throws rather than no-opping | `test/bench.test.mjs::an unknown tamper id throws rather than silently no-opping` |
| every button is `type="button"` | `test/bench-dom.test.mjs::every button carries type=button so a host form never submits` |

### The measured tamper table

| Claim | Enforced by |
| :-- | :-- |
| no tamper ships without a measurement behind it | `test/bench-careful.test.mjs::every bundled tamper ships with the measurement behind it` |
| misquote → VALIDATOR stop, rejected-draft | `test/bench-careful.test.mjs::tamper "${tamper.id}" lands exactly where the table says` |
| smuggle → VALIDATOR stop, rejected-draft | `test/bench-careful.test.mjs::tamper "${tamper.id}" lands exactly where the table says` |
| unresolved → GATE stop, clarification-needed | `test/bench-careful.test.mjs::tamper "${tamper.id}" lands exactly where the table says` |
| widen-subject → SCOPE stop, refused | `test/bench-careful.test.mjs::tamper "${tamper.id}" lands exactly where the table says` |
| unregistered → REGISTRY warn, cannot-execute | `test/bench-careful.test.mjs::tamper "${tamper.id}" lands exactly where the table says` |
| **widen-window → nothing refuses it** (the published miss) | `test/bench-careful.test.mjs::tamper "${tamper.id}" lands exactly where the table says` |
| the baseline the bench ships with runs clean | `test/bench-careful.test.mjs::the baseline the bench ships with runs clean, or the table means nothing` |

### The recorded runs

| Claim | Enforced by |
| :-- | :-- |
| all five recorded live runs replay exactly — rail, coverage, ledger, disposition | `test/parity.test.mjs::recorded run "${c.id}" replays exactly` — one test per case: plain, hostile, cap, confirmed-cap, least |
| the ledger the careful side read is itself a record, not an assumption | `test/parity.test.mjs::the recorded ledger is one file, and the capped cases were served a different page of it` |
| the full read reproduces the recorded answer key | `test/verifier.test.mjs::full read reproduces the recorded answer key` |
| the capped read reproduces the recorded partial claim | `test/verifier.test.mjs::capped read reproduces the recorded partial claim (Alder 340 over 500 rows)` |

### The example and the build

| Claim | Enforced by |
| :-- | :-- |
| `examples/index.html` runs the built bench out of `dist/` | `test/example.test.mjs::the example page loads the module it ships with, into the container it declares` |
| the example mounts, runs clean, and catches a tamper | `test/example.test.mjs::the example runs clean, then catches a tamper, in a DOM` |
| the README's bench snippet compiles | `npm run typecheck` compiles `examples/demo.ts` |
| the declarations match the real surface | `npm run typecheck` compiles `test/types-smoke.ts` |
| the bench tests exercise `dist/`, not the sources | `test/bench.test.mjs`, `test/bench-dom.test.mjs`, `test/bench-honesty.test.mjs`, `test/bench-careful.test.mjs` all import `../dist/bench/index.js` |

### This document

| Claim | Enforced by |
| :-- | :-- |
| every citation on this page names a test that exists, spelled as the source spells it | `test/claims-map.test.mjs::every test CLAIMS.md cites exists, spelled the way the source spells it` |
| no test file in the suite enforces something this page does not admit to | `test/claims-map.test.mjs::every test file in the suite is cited by CLAIMS.md` |
| the CI steps cited below are the steps the workflow declares | `test/claims-map.test.mjs::the CI steps CLAIMS.md leans on are the steps the workflow declares` |

### Enforced by CI, not by a unit test

| Claim | Enforced by |
| :-- | :-- |
| node 18+ | `.github/workflows/test.yml` — the matrix runs 18, 22 and 24 |
| CI packs the tarball, installs it, and imports the root | `.github/workflows/test.yml` — step "install proof" |
| …and mounts the bench from `./bench` in a DOM | `.github/workflows/test.yml` — step "the packed bench mounts and catches, in a DOM" |

## Claims that are not test-enforceable, stated as such

- **"[Live tamper bench](https://miguelsanchez.co.uk/careful-machine)"** — a
  hosted deployment outside this repository. Nothing here can assert what a
  third-party page is running; the tests prove the pairing works, not that a
  given URL serves it.
- **"A git install works too; npm's `prepare` builds `dist/`"** — the
  packed-tarball path is proven in CI; the git path needs the network and is
  not exercised.
- **"this came out of one body of production LLM work"** and **"All
  identifiers and numbers in the fixture data are synthetic and
  illustrative"** — statements about where the data came from, not about
  behaviour.
- Badge images (CI status, npm version, licence) report their own state.
