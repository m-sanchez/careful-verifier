/** The bench, minus the page: a deterministic try-to-trick-it core.
 *
 * You bring a draft, a verifier, and a set of named tampers. The bench
 * applies tampers, runs the verifier, and keeps the history. It renders
 * nothing and fetches nothing; mount.ts puts it on a page, and the
 * verifier you plug in is the thing on trial. */

export interface Checkpoint {
  label: string;
  status: 'pass' | 'warn' | 'stop';
  detail?: string;
}

export interface Report {
  checkpoints: Checkpoint[];
  outcome: string;
}

export interface Tamper<D> {
  id: string;
  label: string;
  /** what the visitor should learn when the verifier catches this */
  note?: string;
  apply: (draft: D) => D;
}

export interface BenchConfig<D> {
  baseline: D;
  verify: (draft: D) => Report;
  tampers: Tamper<D>[];
  /** defaults to structuredClone */
  clone?: (draft: D) => D;
}

export interface RunEntry<D> {
  applied: string[];
  draft: D;
  report: Report;
}

export class Bench<D> {
  private readonly config: BenchConfig<D>;
  private readonly cloneOf: (d: D) => D;
  private current: D;
  private applied: string[] = [];
  readonly history: Array<RunEntry<D>> = [];

  constructor(config: BenchConfig<D>) {
    const ids = new Set(config.tampers.map((t) => t.id));
    if (ids.size !== config.tampers.length) throw new Error('tamper ids must be unique');
    this.config = config;
    this.cloneOf = config.clone ?? ((d) => structuredClone(d));
    this.current = this.cloneOf(config.baseline);
  }

  get draft(): D {
    return this.cloneOf(this.current);
  }

  get appliedTampers(): string[] {
    return [...this.applied];
  }

  tamper(id: string): this {
    const t = this.config.tampers.find((x) => x.id === id);
    if (!t) throw new Error(`no tamper "${id}"`);
    this.current = t.apply(this.cloneOf(this.current));
    this.applied.push(id);
    return this;
  }

  /** Hand-edit the draft directly; recorded as such. */
  edit(next: D): this {
    this.current = this.cloneOf(next);
    this.applied.push('hand-edit');
    return this;
  }

  reset(): this {
    this.current = this.cloneOf(this.config.baseline);
    this.applied = [];
    return this;
  }

  /** Run the verifier over the current draft. The report is appended to
   * history with exactly what was applied to produce it. A verifier that
   * throws is contained: the widget exists to invite hostile drafts, so a
   * crash becomes a stop checkpoint, never a dead page. */
  run(): RunEntry<D> {
    let report: Report;
    try {
      report = this.config.verify(this.cloneOf(this.current));
    } catch (err) {
      report = {
        checkpoints: [
          {
            label: 'verifier',
            status: 'stop',
            detail: `the verifier threw instead of reporting: ${err instanceof Error ? err.message : err}`
          }
        ],
        outcome: 'verifier error: this draft found a crash, which is a finding too'
      };
    }
    const entry: RunEntry<D> = {
      applied: [...this.applied],
      draft: this.cloneOf(this.current),
      report
    };
    this.history.push(entry);
    return entry;
  }
}
