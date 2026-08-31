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

export interface RunOptions {
  cap?: number | null;
  forgedCount?: number | null;
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

export declare const DEPLOYMENT: {
  clock: string;
  subjects: string[];
  sources: string[];
  askKinds: string[];
  cap: number;
};

export declare function extractLedgerCsv(userMessage: string): string;
export declare function parseLedger(csv: string): LedgerRow[];
export declare function computeRead(
  rows: LedgerRow[],
  window: { from: string; to: string },
  cap?: number | null
): ReadModel;
export declare function validateDraft(
  draft: unknown,
  question: string
): { verdict: 'accepted' | 'rejected'; reason?: string };
export declare function runCareful(
  question: string,
  draft: Draft,
  rows: LedgerRow[],
  opts?: RunOptions
): RunResult;
