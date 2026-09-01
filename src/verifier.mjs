/**
 * The careful machine's deterministic side: mechanical draft validation, then
 * the gate → scope → registry → evidence → clerk → dispose pipeline over a
 * frozen synthetic ledger. Plain JS (with JSDoc) so `node --test` runs it
 * without a transpiler and a browser bundle carries no framework.
 *
 * This is the verifier behind the live tamper bench at
 * https://miguelsanchez.co.uk/careful-machine, where it runs in the visitor's
 * browser against tampered drafts; test/verifier.test.mjs pins its arithmetic
 * to the answer key recorded in data/cases.json. The model never runs here;
 * drafts are input, and this code decides what they are allowed to become.
 */

/**
 * @typedef {{ date: string, party: string, internal: boolean }} LedgerRow
 * @typedef {{ state: 'resolved' | 'assumed' | 'unresolved', default?: string }} Resolution
 * @typedef {{ kind: string, direction?: string, qualifiers?: string[], sourceSpan: string, resolution: Resolution }} Ask
 * @typedef {{ subjects: string[], sources: string[], window: { from: string, to: string, origin: string }, asks: Ask[], unclaimedText: string[] }} Draft
 * @typedef {{ kind: string, artifactText: string, ground: string, gloss: string }} Catch
 * @typedef {{ station: string, status: 'pass' | 'warn' | 'stop', detail: string, chapter?: string, catch?: Catch, climax?: boolean }} Checkpoint
 * @typedef {{ assertion: string, coverageClaimed: 'complete' | 'partial', outcome: 'certified' | 'struck', failingCheck?: string }} LedgerClaim
 * @typedef {{ itemsRead?: number, populationCount: number }} ReadRecord
 * @typedef {{ kind: string, direction?: string, certifies: boolean, label?: string }} RegisteredOp
 * @typedef {{
 *   clock?: string,
 *   subjects: string[],
 *   sources: string[],
 *   askKinds: string[],
 *   cap?: number,
 *   window?: { from: string, to: string, label: string },
 *   ops: RegisteredOp[],
 *   vocabulary: { entity: string, unit: string }
 * }} Deployment
 * @typedef {{ cap?: number | null, forgedCount?: number | null, read?: ReadRecord | null, standing?: string, deployment?: Deployment }} RunOptions
 * @typedef {{
 *   attempt: { verdict: 'accepted' | 'rejected', reason?: string },
 *   contract: Draft | null,
 *   checkpoints: Checkpoint[],
 *   coverage: { itemsRead: number, populationCount: number, complete: boolean, capApplied: boolean } | null,
 *   claimsLedger: LedgerClaim[],
 *   answer: string,
 *   disposition: { disposition: string, pathToYes: string },
 *   quarantined: string[],
 *   notes: string[]
 * }} RunResult
 */

/**
 * The recorded deployment, verbatim: what that build may touch and do. It is
 * the default, not the only one - every station reads the deployment it was
 * handed, so a caller in another domain passes `{ deployment }` and gets the
 * same records in its own vocabulary. test/fixtures/support-desk.mjs is a
 * second, non-payments deployment proving exactly that.
 * @type {Deployment}
 */
export const DEPLOYMENT = {
  clock: '2025-07-04',
  subjects: ['acct-1187'],
  sources: ['payments'],
  askKinds: ['total', 'ranking', 'presence', 'first-appearance'],
  cap: 500,
  /** The window this build's records cover, and what the requester calls it.
   * The certified claim borrows the label only for exactly this window; any
   * other window is named by its dates, so the assertion text cannot outrun
   * the read. */
  window: { from: '2025-04-01', to: '2025-07-04', label: 'this quarter' },
  /** The registry, declared: what this build can do, and whether doing it
   * certifies a claim. `certifies: false` means the ask is recorded and
   * nothing more - the run may not speak it. Anything absent is capability
   * this build does not have and will not invent. */
  ops: [
    { kind: 'ranking', direction: 'most', certifies: true, label: 'rank most-frequent' },
    { kind: 'presence', certifies: false }
  ],
  /** What a ranked thing is called here, and what is being counted. */
  vocabulary: { entity: 'payee', unit: 'payments' }
};

/**
 * Reject, never repair, applied to the deployment itself: a build that cannot
 * say what it may touch, what it can do, or what its claims are about has no
 * business certifying anything.
 * @param {Deployment | undefined | null} d
 * @returns {Deployment}
 */
function resolveDeployment(d) {
  if (d == null) return DEPLOYMENT;
  if (typeof d !== 'object') throw new Error('deployment must be an object');
  for (const key of ['subjects', 'sources', 'askKinds', 'ops']) {
    if (!Array.isArray(/** @type {Record<string, unknown>} */ (d)[key])) {
      throw new Error(`deployment.${key} must be an array`);
    }
  }
  const v = d.vocabulary;
  if (typeof v !== 'object' || v === null || typeof v.entity !== 'string' || typeof v.unit !== 'string') {
    throw new Error('deployment.vocabulary must name an entity and a unit');
  }
  for (const op of d.ops) {
    if (typeof op.kind !== 'string' || typeof op.certifies !== 'boolean') {
      throw new Error('every deployment.ops entry needs a kind and a certifies flag');
    }
  }
  return d;
}

/**
 * How a window is named in a certified claim. The deployment's own label is
 * borrowed only for the deployment's own window; anything else is named by
 * its dates, so a widened read cannot keep the narrower word.
 * @param {Deployment} deployment
 * @param {{ from: string, to: string }} window
 */
function periodLabel(deployment, window) {
  const w = deployment.window;
  return w != null && w.from === window.from && w.to === window.to ? w.label : `${window.from}..${window.to}`;
}

/**
 * The claim wording, derived: what was ranked, over which window, in this
 * deployment's vocabulary. The partial form names no period at all - it can
 * only speak for the rows it read.
 * @param {Deployment} deployment
 * @param {{ from: string, to: string }} window
 * @param {{ name: string, n: number }} top
 * @param {'complete' | 'partial'} form
 */
function rankedClaim(deployment, window, top, form) {
  const { entity, unit } = deployment.vocabulary;
  return form === 'partial'
    ? `most frequent ${entity} within the examined rows: ${top.name} (${top.n} of the rows read)`
    : `most frequent ${entity} ${periodLabel(deployment, window)}: ${top.name} (${top.n} ${unit})`;
}

/**
 * Which declared operation, if any, covers an ask. An op with no direction
 * covers every direction of its kind.
 * @param {{ kind: string, direction?: string, certifies: boolean }[]} ops
 * @param {Ask} ask
 */
function opFor(ops, ask) {
  return ops.find((o) => o.kind === ask.kind && (o.direction == null || o.direction === ask.direction)) ?? null;
}

const CHAPTER = {
  VALIDATOR: 'ch. 3-4',
  GATE: 'ch. 3 · gate.ts',
  SCOPE: 'ch. 6 · scope.ts',
  REGISTRY: 'ch. 5 · registry.ts',
  EVIDENCE: 'ch. 7-8 · execute.ts',
  CLERK: 'ch. 11 · verify.ts',
  ANSWER: 'ch. 13 · dispose.ts',
  REPLAY: 'ch. 17 · replay.ts'
};

/**
 * Pull the CSV rows out of a recorded fused request's user message, where the
 * full ledger travels as `question\n\nPAYMENT DATA:\n<rows>`.
 * @param {string} userMessage
 * @returns {string}
 */
export function extractLedgerCsv(userMessage) {
  const marker = 'PAYMENT DATA:\n';
  const i = userMessage.indexOf(marker);
  if (i < 0) throw new Error('no PAYMENT DATA block in the recorded user message');
  return userMessage.slice(i + marker.length);
}

/**
 * Parse `date,counterparty[,internal-transfer]` rows, preserving file order
 * (the cap reads the file top-down, so order is load-bearing).
 * @param {string} csv
 * @returns {LedgerRow[]}
 */
export function parseLedger(csv) {
  const rows = [];
  for (const line of csv.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const parts = t.split(',');
    if (parts.length < 2) throw new Error(`unparseable ledger row: "${t}"`);
    rows.push({ date: parts[0], party: parts[1], internal: parts[2] === 'internal-transfer' });
  }
  return rows;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Count what a read of the ledger actually establishes: external frequency
 * over the rows read, in-window population, and (from the full file, for the
 * answer key) which external parties are genuinely new to the window.
 *
 * Coverage is a *declared* record, not an inference from however many rows
 * the caller happened to pass. Without `declared`, the rows handed in are
 * taken to be the whole in-window population - true for a caller that reads
 * the file, false for anyone who paginates, samples or pre-filters. Those
 * callers declare `{ populationCount }` (optionally `{ itemsRead }`) and the
 * read is stamped partial even though every row it was given was counted.
 * @param {LedgerRow[]} rows
 * @param {{ from: string, to: string }} window
 * @param {number | null} [cap] rows the read may touch, file order; null = all
 * @param {ReadRecord | null} [declared] the coverage the caller can vouch for
 */
export function computeRead(rows, window, cap = null, declared = null) {
  const inWindow = rows.filter((r) => r.date >= window.from && r.date <= window.to);
  const read = cap != null ? inWindow.slice(0, cap) : inWindow;
  const counted = read.length;
  let itemsRead = counted;
  let populationCount = inWindow.length;
  if (declared != null) {
    const whole = (/** @type {unknown} */ n) => typeof n === 'number' && Number.isInteger(n) && n >= 0;
    if (!whole(declared.populationCount)) {
      throw new Error('declared read: populationCount must be a whole number of rows');
    }
    if (declared.itemsRead != null) {
      if (!whole(declared.itemsRead)) throw new Error('declared read: itemsRead must be a whole number of rows');
      if (declared.itemsRead < counted) {
        throw new Error(
          `declared read: itemsRead ${declared.itemsRead} is below the ${counted} rows counted; a read cannot claim less coverage than it used`
        );
      }
      itemsRead = declared.itemsRead;
    }
    if (declared.populationCount < itemsRead) {
      throw new Error(
        `declared read: populationCount ${declared.populationCount} is below the ${itemsRead} rows read`
      );
    }
    populationCount = declared.populationCount;
  }
  /** @type {Map<string, number>} */
  const external = new Map();
  for (const r of read) {
    if (r.internal) continue;
    external.set(r.party, (external.get(r.party) ?? 0) + 1);
  }
  const counts = [...external.entries()]
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  /** @type {Map<string, string>} */
  const firstSeen = new Map();
  for (const r of rows) {
    if (r.internal) continue;
    if (!firstSeen.has(r.party) || r.date < /** @type {string} */ (firstSeen.get(r.party))) {
      firstSeen.set(r.party, r.date);
    }
  }
  const partiesInWindow = [...new Set(inWindow.filter((r) => !r.internal).map((r) => r.party))];
  const genuinelyNew = partiesInWindow
    .filter((p) => /** @type {string} */ (firstSeen.get(p)) >= window.from)
    .sort();
  const seenBefore = partiesInWindow
    .filter((p) => /** @type {string} */ (firstSeen.get(p)) < window.from)
    .sort();
  return {
    rowsTotal: rows.length,
    populationCount,
    itemsRead,
    complete: itemsRead >= populationCount,
    counts,
    top: counts[0] ?? null,
    least: counts.length > 0 ? counts[counts.length - 1] : null,
    genuinelyNew,
    seenBefore
  };
}

/**
 * The mechanical validator: reject, never repair. Everything here is a check
 * JSON Schema cannot express, chiefly that every quoted span really is the
 * requester's verbatim words.
 * @param {unknown} draft
 * @param {string} question
 * @param {Deployment} [deployment] defaults to the recorded payments deployment
 * @returns {{ verdict: 'accepted' | 'rejected', reason?: string }}
 */
export function validateDraft(draft, question, deployment = DEPLOYMENT) {
  /** @param {string} reason */
  const reject = (reason) => ({ verdict: /** @type {const} */ ('rejected'), reason });
  if (typeof draft !== 'object' || draft === null) return reject('draft is not an object');
  const d = /** @type {Record<string, unknown>} */ (draft);
  for (const key of ['subjects', 'sources', 'asks', 'unclaimedText']) {
    if (!Array.isArray(d[key])) return reject(`"${key}" must be an array`);
  }
  const w = /** @type {Record<string, unknown>} */ (d.window);
  if (typeof w !== 'object' || w === null) return reject('"window" must be an object');
  if (typeof w.from !== 'string' || !DATE_RE.test(w.from)) return reject('window.from is not a YYYY-MM-DD date');
  if (typeof w.to !== 'string' || !DATE_RE.test(w.to)) return reject('window.to is not a YYYY-MM-DD date');
  if (w.from > w.to) return reject('window.from is after window.to');
  if (w.origin !== 'stated' && w.origin !== 'assumed') return reject('window.origin must be stated or assumed');
  const asks = /** @type {unknown[]} */ (d.asks);
  if (asks.length === 0) return reject('no asks: an empty reading certifies nothing');
  for (const raw of asks) {
    const a = /** @type {Record<string, unknown>} */ (raw);
    if (typeof a !== 'object' || a === null) return reject('an ask is not an object');
    if (typeof a.kind !== 'string' || !deployment.askKinds.includes(a.kind)) {
      return reject(`ask kind "${String(a.kind)}" is not in the schema`);
    }
    if (a.kind === 'ranking' && a.direction !== 'most' && a.direction !== 'least') {
      return reject('a ranking ask must state its direction (most or least)');
    }
    if (typeof a.sourceSpan !== 'string' || a.sourceSpan.length === 0) {
      return reject('an ask is missing its sourceSpan');
    }
    if (!question.includes(a.sourceSpan)) {
      return reject(`sourceSpan is not the requester's verbatim words: "${a.sourceSpan}"`);
    }
    const res = /** @type {Record<string, unknown>} */ (a.resolution);
    if (typeof res !== 'object' || res === null || !['resolved', 'assumed', 'unresolved'].includes(/** @type {string} */ (res.state))) {
      return reject('an ask is missing a valid resolution state');
    }
  }
  for (const span of /** @type {unknown[]} */ (d.unclaimedText)) {
    if (typeof span !== 'string' || !question.includes(span)) {
      return reject(`unclaimedText is not the requester's verbatim words: "${String(span)}"`);
    }
  }
  return { verdict: 'accepted' };
}

/** @param {Ask} a */
function askLabel(a) {
  return `${a.kind}${a.direction ? ` (${a.direction})` : ''} ← ${a.sourceSpan}`;
}

/**
 * Run the deterministic pipeline over an accepted (or tampered) draft.
 * The stations, statuses, and catch wording match the recorded runs; only the
 * inputs vary. Nothing here consults a model.
 * @param {string} question
 * @param {Draft} draft
 * @param {LedgerRow[]} rows
 * @param {RunOptions} [opts]
 * @returns {RunResult}
 */
export function runCareful(question, draft, rows, opts = {}) {
  const cap = opts.cap ?? null;
  const forgedCount = opts.forgedCount ?? null;
  const declaredRead = opts.read ?? null;
  const deployment = resolveDeployment(opts.deployment);
  // standing is a record of how this reading was admitted, not a literal:
  // the recorded runs carry both policy-admitted and requester-confirmed
  const standing = opts.standing ?? 'policy-admitted';
  if (typeof standing !== 'string' || standing.length === 0) {
    throw new Error('standing must be a non-empty string naming how the reading was admitted');
  }
  /** @type {Checkpoint[]} */
  const checkpoints = [];
  /** @type {string[]} */
  const notes = [];
  const quarantined = Array.isArray(draft?.unclaimedText) ? [...draft.unclaimedText] : [];

  // VALIDATOR - reject, never repair
  const attempt = validateDraft(draft, question, deployment);
  if (attempt.verdict === 'rejected') {
    checkpoints.push({
      station: 'VALIDATOR',
      status: 'stop',
      detail: `draft rejected: ${attempt.reason} (reject, never repair)`,
      chapter: CHAPTER.VALIDATOR,
      catch: {
        kind: 'rejected-draft',
        artifactText: attempt.reason ?? 'invalid draft',
        ground: 'mechanical validation failed',
        gloss: 'a draft that misquotes the requester never acquires standing'
      },
      climax: true
    });
    return {
      attempt,
      contract: null,
      checkpoints,
      coverage: null,
      claimsLedger: [],
      answer: 'No certified reading: the draft was rejected and nothing acquired standing.',
      disposition: { disposition: 'rejected-draft', pathToYes: 'draft again, quoting the requester verbatim' },
      quarantined,
      notes
    };
  }
  checkpoints.push({
    station: 'VALIDATOR',
    status: 'pass',
    detail: 'draft accepted by mechanical validation (reject, never repair)',
    chapter: CHAPTER.VALIDATOR
  });

  // GATE - unresolved ambiguity goes back to the requester before any read
  const unresolved = draft.asks.find((a) => a.resolution.state === 'unresolved');
  if (unresolved) {
    checkpoints.push({
      station: 'GATE',
      status: 'stop',
      detail: 'clarification-needed; nothing executes',
      chapter: CHAPTER.GATE,
      catch: {
        kind: 'clarification',
        artifactText: `"${unresolved.sourceSpan}"`,
        ground: 'unresolved ambiguity in the reading',
        gloss: 'the gate routes the question back instead of letting a guess acquire standing'
      },
      climax: true
    });
    return {
      attempt,
      contract: draft,
      checkpoints,
      coverage: null,
      claimsLedger: [],
      answer: `No answer yet: before reading a single row, the gate routes the ambiguity back to you. What did you mean by "${unresolved.sourceSpan}"?`,
      disposition: { disposition: 'clarification-needed', pathToYes: 'answer the clarifying question, then re-run' },
      quarantined,
      notes
    };
  }
  checkpoints.push({
    station: 'GATE',
    status: 'pass',
    detail: `certified · standing ${standing}`,
    chapter: CHAPTER.GATE
  });

  // SCOPE - authority is a record; a wider read never happens
  const badSubjects = draft.subjects.filter((s) => !deployment.subjects.includes(s));
  const badSources = draft.sources.filter((s) => !deployment.sources.includes(s));
  if (badSubjects.length > 0 || badSources.length > 0) {
    const offending = badSubjects.length > 0 ? `subjects [${badSubjects.join(', ')}]` : `sources [${badSources.join(', ')}]`;
    checkpoints.push({
      station: 'SCOPE',
      status: 'stop',
      detail: 'scope-conflict; nothing is read',
      chapter: CHAPTER.SCOPE,
      catch: {
        kind: 'scope-conflict',
        artifactText: offending,
        ground: `the recorded grant covers [${deployment.subjects.join(', ')}] and [${deployment.sources.join(', ')}] only`,
        gloss: 'authority is a record, not a request; the wider read never happens'
      },
      climax: true
    });
    return {
      attempt,
      contract: draft,
      checkpoints,
      coverage: null,
      claimsLedger: [],
      answer: `Declined at scope: this deployment's grant covers ${deployment.subjects.join(', ')} only, and ${offending} sits outside it. Nothing was read.`,
      disposition: { disposition: 'refused', pathToYes: `scope the request to ${deployment.subjects.join(', ')}, then re-run` },
      quarantined,
      notes
    };
  }
  checkpoints.push({
    station: 'SCOPE',
    status: 'pass',
    detail: `accepted · in scope [${deployment.subjects.join(', ')}]`,
    chapter: CHAPTER.SCOPE
  });

  // REGISTRY - capability is the declared record, read here rather than
  // re-enumerated: an ask is executable only if a declared op certifies it,
  // recorded only if a declared op covers it without certifying, and
  // unregistered otherwise. Anything the registry cannot back, this build
  // will not invent.
  const ops = deployment.ops;
  const executable = draft.asks.filter((a) => opFor(ops, a)?.certifies === true);
  const unregistered = draft.asks.filter((a) => opFor(ops, a) == null);
  if (unregistered.length > 0) {
    const first = unregistered[0];
    const ground =
      first.kind === 'ranking'
        ? 'no registered operation establishes least-frequent ranking'
        : `no registered operation establishes "${first.kind}" in this build`;
    checkpoints.push({
      station: 'REGISTRY',
      status: 'warn',
      detail: `cannot-execute: ${unregistered.length} ask(s) have no registered operation`,
      chapter: CHAPTER.REGISTRY,
      catch: {
        kind: 'refusal',
        artifactText: askLabel(first),
        ground,
        gloss: 'capability is a record; honest refusal beats invented ability'
      },
      climax: true
    });
  } else if (executable.length === 0) {
    // every ask is registered, but only for the record: nothing here can
    // certify a claim, and the checkpoint has to say so rather than stamp a
    // pass the disposition is about to contradict
    const first = draft.asks[0];
    checkpoints.push({
      station: 'REGISTRY',
      status: 'warn',
      detail: `cannot-execute: ${draft.asks.length} ask(s) are recorded only; no registered operation certifies one`,
      chapter: CHAPTER.REGISTRY,
      catch: {
        kind: 'refusal',
        artifactText: askLabel(first),
        ground: `"${first.kind}" is recorded in this build, but no registered operation certifies it`,
        gloss: 'capability is a record; honest refusal beats invented ability'
      },
      climax: true
    });
  } else {
    checkpoints.push({
      station: 'REGISTRY',
      status: 'pass',
      detail: 'every ask has a registered operation',
      chapter: CHAPTER.REGISTRY
    });
  }

  // EVIDENCE - the counting loop; every row it touches is stamped
  const read = computeRead(rows, draft.window, cap, declaredRead);
  const capApplied = !read.complete;
  checkpoints.push({
    station: 'EVIDENCE',
    status: capApplied ? 'warn' : 'pass',
    detail: capApplied
      ? `read ${read.itemsRead} of ${read.populationCount} · PARTIAL, stamped honestly`
      : `read ${read.itemsRead} of ${read.populationCount} · complete, stamped`,
    chapter: CHAPTER.EVIDENCE,
    ...(capApplied
      ? {
          catch: {
            kind: 'partial-coverage',
            artifactText: `${read.itemsRead} of ${read.populationCount} rows`,
            ground: cap != null ? 'read capped' : 'declared partial read',
            gloss: 'claims may only carry the coverage they can support'
          }
        }
      : {})
  });
  const coverage = {
    itemsRead: read.itemsRead,
    populationCount: read.populationCount,
    complete: read.complete,
    capApplied
  };

  // CLERK - the narrator can only speak certified claims
  /** @type {LedgerClaim[]} */
  const claimsLedger = [];
  let certifiedAnswer = null;
  if (executable.length > 0 && read.top) {
    if (forgedCount != null && forgedCount !== read.top.n) {
      claimsLedger.push({
        assertion: rankedClaim(deployment, draft.window, { name: read.top.name, n: forgedCount }, 'complete'),
        coverageClaimed: 'complete',
        outcome: 'struck',
        failingCheck: `the loop counted ${read.top.n} for ${read.top.name}; the proposal says ${forgedCount}`
      });
    }
    if (capApplied) {
      claimsLedger.push({
        assertion: rankedClaim(deployment, draft.window, read.top, 'complete'),
        coverageClaimed: 'complete',
        outcome: 'struck',
        failingCheck: 'unqualified ranking over a partial read; certify the qualified form instead'
      });
      certifiedAnswer = rankedClaim(deployment, draft.window, read.top, 'partial');
      claimsLedger.push({ assertion: certifiedAnswer, coverageClaimed: 'partial', outcome: 'certified' });
    } else {
      certifiedAnswer = rankedClaim(deployment, draft.window, read.top, 'complete');
      claimsLedger.push({ assertion: certifiedAnswer, coverageClaimed: 'complete', outcome: 'certified' });
    }
  }
  const struck = claimsLedger.filter((c) => c.outcome === 'struck');
  const firstStruck = struck[0];
  checkpoints.push({
    station: 'CLERK',
    status: struck.length > 0 ? 'warn' : 'pass',
    detail:
      struck.length > 0
        ? `struck ${struck.length} claim(s) at the turnstile`
        : claimsLedger.length > 0
          ? 'all proposed claims certified'
          : 'no claims proposed',
    chapter: CHAPTER.CLERK,
    ...(firstStruck
      ? {
          catch: {
            kind: 'struck-claim',
            artifactText: firstStruck.assertion,
            ground: firstStruck.failingCheck ?? 'failed certification',
            gloss: 'the narrator can only speak certified claims; this one died here, in writing'
          },
          climax: true
        }
      : {})
  });

  for (const a of draft.asks) {
    if (opFor(ops, a)?.certifies === false) {
      notes.push(
        `the ${a.kind} ask is recorded, but no registered operation certifies it; it stays silent instead of guessing`
      );
    }
  }

  // ANSWER - dispose: answered, degraded, or an honest cannot-execute
  /** @type {{ disposition: string, pathToYes: string }} */
  let disposition;
  let answer;
  if (certifiedAnswer == null) {
    disposition = { disposition: 'cannot-execute', pathToYes: 'ask for the nearest thing this build CAN check' };
    const certifying = ops.filter((o) => o.certifies).map((o) => o.label ?? `${o.kind}${o.direction ? ` (${o.direction})` : ''}`);
    answer =
      `declined, not guessed: this build can ${certifying.length > 0 ? `${certifying.join(', ')} only` : 'certify nothing'}; it has no approved way to establish what was asked, so it declines instead of answering a different question.`;
    checkpoints.push({
      station: 'ANSWER',
      status: 'warn',
      detail: `cannot-execute · to unlock the rest: ${disposition.pathToYes}`,
      chapter: CHAPTER.ANSWER
    });
  } else if (capApplied) {
    disposition = { disposition: 'degraded', pathToYes: 'run the full read' };
    answer = certifiedAnswer;
    checkpoints.push({
      station: 'ANSWER',
      status: 'warn',
      detail: `degraded · to unlock the rest: ${disposition.pathToYes}`,
      chapter: CHAPTER.ANSWER
    });
  } else {
    disposition = { disposition: 'answered', pathToYes: 'none' };
    answer = certifiedAnswer;
    checkpoints.push({ station: 'ANSWER', status: 'pass', detail: 'answered', chapter: CHAPTER.ANSWER });
  }

  // REPLAY - the run is a record; every reference resolves
  checkpoints.push({
    station: 'REPLAY',
    status: 'pass',
    detail: 'every reference resolves',
    chapter: CHAPTER.REPLAY
  });

  return { attempt, contract: draft, checkpoints, coverage, claimsLedger, answer, disposition, quarantined, notes };
}
