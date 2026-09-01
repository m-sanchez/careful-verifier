/** Hand-written declarations for verifier.mjs (plain JS so node --test runs it). */

export interface LedgerRow {
  date: string;
  party: string;
  internal: boolean;
}

export interface Resolution {
  state: 'resolved' | 'assumed' | 'unresolved';
  default?: string;
}

export interface Ask {
  kind: string;
  direction?: string;
  qualifiers?: string[];
  sourceSpan: string;
  resolution: Resolution;
}

export interface Draft {
  subjects: string[];
  sources: string[];
  window: { from: string; to: string; origin: string };
  asks: Ask[];
  unclaimedText: string[];
}

export interface Catch {
  kind: string;
  artifactText: string;
  ground: string;
  gloss: string;
}

export interface Checkpoint {
  station: string;
  status: 'pass' | 'warn' | 'stop';
  detail: string;
  chapter?: string;
  catch?: Catch;
  climax?: boolean;
}

export interface LedgerClaim {
  assertion: string;
  coverageClaimed: 'complete' | 'partial';
  outcome: 'certified' | 'struck';
  failingCheck?: string;
}

/** The coverage a caller can vouch for when the rows handed in are not the
 * whole population (pagination, sampling, a pre-filter). */
export interface ReadRecord {
  /** rows the read touched; defaults to the rows counted here */
  itemsRead?: number;
  /** rows that exist in the window - may exceed the rows handed in */
  populationCount: number;
}

export interface RunOptions {
  cap?: number | null;
  forgedCount?: number | null;
  read?: ReadRecord | null;
  /** how this reading was admitted; recorded verbatim at the gate */
  standing?: string;
  /** defaults to DEPLOYMENT, the recorded payments deployment */
  deployment?: Deployment;
}

export interface RunResult {
  attempt: { verdict: 'accepted' | 'rejected'; reason?: string };
  contract: Draft | null;
  checkpoints: Checkpoint[];
  coverage: { itemsRead: number; populationCount: number; complete: boolean; capApplied: boolean } | null;
  claimsLedger: LedgerClaim[];
  answer: string;
  disposition: { disposition: string; pathToYes: string };
  quarantined: string[];
  notes: string[];
}

export interface ReadModel {
  rowsTotal: number;
  populationCount: number;
  itemsRead: number;
  complete: boolean;
  counts: { name: string; n: number }[];
  top: { name: string; n: number } | null;
  least: { name: string; n: number } | null;
  genuinelyNew: string[];
  seenBefore: string[];
}

export interface RegisteredOp {
  kind: string;
  direction?: string;
  /** false = the ask is recorded, but no operation certifies a claim from it */
  certifies: boolean;
  /** how a refusal names this operation, e.g. "rank most-frequent" */
  label?: string;
}

/** What a build may touch, what it can do, and what its claims are about.
 * Pass one to runCareful to run the same stations in another domain. */
export interface Deployment {
  clock?: string;
  subjects: string[];
  sources: string[];
  askKinds: string[];
  cap?: number;
  /** the window this build's records cover, and the requester's word for it;
   * the label is used only for exactly this window */
  window?: { from: string; to: string; label: string };
  ops: RegisteredOp[];
  vocabulary: { entity: string; unit: string };
}

export declare const DEPLOYMENT: Deployment;

export declare function extractLedgerCsv(userMessage: string): string;
export declare function parseLedger(csv: string): LedgerRow[];
export declare function computeRead(
  rows: LedgerRow[],
  window: { from: string; to: string },
  cap?: number | null,
  declared?: ReadRecord | null
): ReadModel;
export declare function validateDraft(
  draft: unknown,
  question: string,
  deployment?: Deployment
): { verdict: 'accepted' | 'rejected'; reason?: string };
export declare function runCareful(
  question: string,
  draft: Draft,
  rows: LedgerRow[],
  opts?: RunOptions
): RunResult;
