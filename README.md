# careful-verifier

Models propose, code certifies. A zero-dependency claim verifier for Node and
the browser. No model calls.

[Live tamper bench](https://miguelsanchez.co.uk/careful-machine) ·
[Reference implementation](https://github.com/m-sanchez/careful-machine-reference) ·
[More tools](https://github.com/m-sanchez)

This is the deterministic side of the careful-machine pattern, extracted as a
library. A model may draft a *reading* of a question; this code decides what
that draft is allowed to become. Every draft passes through a station
pipeline (VALIDATOR → GATE → SCOPE → REGISTRY → EVIDENCE → CLERK → ANSWER →
REPLAY) and comes out the other side as checkpoints, a coverage record, a
claims ledger (certified or struck, in writing), and a disposition with a
path to yes. Refusal is a routed outcome, not a failure.

It powers the [live tamper bench](https://miguelsanchez.co.uk/careful-machine):
visitors mutate a model draft in the browser and watch the same code catch it.

## Run

```bash
npm test        # node's built-in runner; no dependencies at all
```

Node 18+. The library is plain JS with JSDoc types (`src/verifier.d.mts`
carries the declarations), so it runs untranspiled in Node and bundles clean
for the browser.

## Use

```js
import { runCareful, validateDraft, parseLedger } from 'careful-verifier';

const result = runCareful(question, draft, rows, { cap: 500 });
result.checkpoints;   // each station: pass, warn, or stop - with what it caught
result.claimsLedger;  // every proposed claim: certified or struck, with the failing check
result.coverage;      // what was read vs what exists - partial reads are stamped
result.disposition;   // answered | degraded | cannot-execute | refused | ... + pathToYes
result.answer;        // only certified claims can appear here
```

The stations enforce, in order: reject-never-repair validation (a draft that
misquotes the requester never acquires standing), a gate that routes
ambiguity back instead of guessing, scope as a record the proposal cannot
widen, capability as a registry (honest refusal beats invented ability),
coverage stamped on every read, a claim turnstile the narrator cannot bypass,
and a disposition derived from records only.

## The tests are the point

`test/verifier.test.mjs` pins the verifier's arithmetic to the answer key of
five recorded live runs (`data/cases.json`: a real model answering the same
question through this pipeline, frozen). Highlights:

| Test | Claim |
| :-- | :-- |
| misquoted sourceSpan rejected, never repaired | validation rejects; repair would launder the misquote |
| hostile draft stops at the gate | the smuggled instruction is quarantined, not executed |
| out-of-grant subject dies at scope | nothing is read; authority is a record |
| least-frequent ask lands cannot-execute | capability is a record; no invented ability |
| forged count struck at the clerk | the loop's own count ships, the forgery dies in writing |
| capped read degrades honestly | unqualified claim struck; qualified form certified |

All identifiers and numbers in the fixture data are synthetic and
illustrative.
