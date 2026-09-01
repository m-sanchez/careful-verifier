/** The page layer: tamper chips, a draft editor, a run button, and a
 * checkpoint rail. Framework-free DOM, styled through class names only
 * (prefix `tb-`), so the host page owns the look. The widget makes no
 * network calls; whatever it proves, it proves locally. */

import { Bench, normalizeReport } from './bench.ts';
import type { BenchConfig, Report } from './bench.ts';

export interface MountOptions {
  /** heading above the bench */
  title?: string;
  /** shown when the draft JSON in the editor does not parse */
  parseErrorText?: string;
  /** the attempt log: false to hide it, a number to cap its length */
  log?: boolean | number;
}

export interface Mounted<D> {
  bench: Bench<D>;
  /** re-render from current bench state (called automatically on clicks) */
  refresh: () => void;
  destroy: () => void;
}

export function mountBench<D>(
  container: HTMLElement,
  config: BenchConfig<D>,
  opts: MountOptions = {}
): Mounted<D> {
  const bench = new Bench(config);
  const doc = container.ownerDocument;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
    const node = doc.createElement(tag);
    node.className = className;
    if (text != null) node.textContent = text;
    // type="button" everywhere: embedded inside a host <form>, a default
    // submit button would post the page on every chip click
    if (node instanceof (doc.defaultView?.HTMLButtonElement ?? HTMLButtonElement)) {
      node.setAttribute('type', 'button');
    }
    return node;
  };
  // canonical form so a key-order-only edit in the textarea is not
  // recorded as a hand edit; provenance should not depend on JSON key order
  const canonical = (value: unknown): string => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  };
  // ...and both sides of that comparison must be the same projection. The
  // editor only ever holds a draft's JSON form, so the live draft is
  // compared in its JSON form too. Otherwise a draft carrying a Date or a
  // Map - the most natural fields in an audit artifact - walks to `{}` on
  // one side and to a string on the other, and every clean run of an
  // untouched baseline is falsely recorded as a hand edit.
  const asJson = (value: D): unknown => JSON.parse(JSON.stringify(value)) as unknown;

  const root = el('div', 'tb-root');
  if (opts.title) root.appendChild(el('h3', 'tb-title', opts.title));

  const chipRow = el('div', 'tb-chips');
  chipRow.setAttribute('role', 'group');
  chipRow.setAttribute('aria-label', 'tampers to apply');
  for (const t of config.tampers) {
    const chip = el('button', 'tb-chip', t.label);
    chip.setAttribute('data-tamper', t.id);
    chip.setAttribute('aria-label', `apply tamper: ${t.label}`);
    if (t.note) chip.title = t.note;
    chip.addEventListener('click', () => {
      // a chip stacks on top of whatever the visitor typed; it never eats it
      if (!absorbEditorEdit()) return;
      bench.tamper(t.id);
      refresh();
    });
    chipRow.appendChild(chip);
  }
  const resetChip = el('button', 'tb-chip tb-chip-reset', 'reset');
  resetChip.addEventListener('click', () => {
    bench.reset();
    refresh();
  });
  chipRow.appendChild(resetChip);
  root.appendChild(chipRow);

  const editor = el('textarea', 'tb-editor');
  editor.rows = 10;
  editor.setAttribute('aria-label', 'draft under test, editable JSON');
  root.appendChild(editor);

  const runButton = el('button', 'tb-run', 'run the verifier');
  root.appendChild(runButton);

  const status = el('div', 'tb-status');
  status.setAttribute('role', 'status');
  const rail = el('ol', 'tb-rail');
  const outcome = el('p', 'tb-outcome');
  root.appendChild(status);
  root.appendChild(rail);
  root.appendChild(outcome);

  // the attempt log: the core already keeps every run with exactly the
  // tampers that produced it, and a visitor who cannot see the tally leaves
  // with an anecdote instead of "six tried, six caught"
  const showLog = opts.log !== false;
  const logLimit = typeof opts.log === 'number' ? opts.log : Infinity;
  const logSummary = el('p', 'tb-log-summary');
  const log = el('ol', 'tb-log');
  if (showLog) {
    root.appendChild(logSummary);
    root.appendChild(log);
  }

  const worst = (report: Report): 'pass' | 'warn' | 'stop' =>
    report.checkpoints.some((k) => k.status === 'stop')
      ? 'stop'
      : report.checkpoints.some((k) => k.status === 'warn')
        ? 'warn'
        : 'pass';

  const renderLog = () => {
    if (!showLog) return;
    log.textContent = '';
    const caught = bench.history.filter((h) => worst(h.report) !== 'pass').length;
    logSummary.textContent =
      bench.history.length === 0
        ? ''
        : `${bench.history.length} attempt${bench.history.length === 1 ? '' : 's'}, ${caught} caught`;
    const entries = bench.history.slice(-logLimit).reverse();
    for (const entry of entries) {
      const applied = entry.applied.length > 0 ? entry.applied.join(' + ') : 'baseline';
      log.appendChild(el('li', `tb-log-entry tb-${worst(entry.report)}`, `${applied} → ${entry.report.outcome}`));
    }
  };

  const renderReport = (value: Report | null) => {
    rail.textContent = '';
    outcome.textContent = '';
    if (!value) return;
    // the render path is guarded in its own right: whatever reaches it is
    // shaped like a report by the time it is walked
    const report = normalizeReport(value);
    for (const k of report.checkpoints) {
      const item = el('li', `tb-checkpoint tb-${k.status}`, `${k.label}: ${k.status}${k.detail ? ` (${k.detail})` : ''}`);
      rail.appendChild(item);
    }
    outcome.textContent = report.outcome;
  };

  const refresh = () => {
    editor.value = JSON.stringify(bench.draft, null, 2);
    status.textContent =
      bench.appliedTampers.length === 0
        ? 'baseline draft'
        : `applied: ${bench.appliedTampers.join(', ')}`;
    renderReport(bench.history.length > 0 ? bench.history[bench.history.length - 1].report : null);
    renderLog();
  };

  /** Read the textarea and record any hand edit before anything else
   * happens. Returns false when the text does not parse, having already
   * said so and left the visitor's text alone. Every control that acts on
   * the draft goes through here first, so an edit is absorbed rather than
   * clobbered by the next click. */
  const absorbEditorEdit = (): boolean => {
    let edited: D;
    try {
      edited = JSON.parse(editor.value) as D;
    } catch {
      status.textContent = opts.parseErrorText ?? 'draft is not valid JSON; fix it or reset';
      return false;
    }
    if (canonical(edited) !== canonical(asJson(bench.draft))) bench.edit(edited);
    return true;
  };

  runButton.addEventListener('click', () => {
    if (!absorbEditorEdit()) return;
    bench.run();
    refresh();
  });

  refresh();
  container.appendChild(root);
  return { bench, refresh, destroy: () => root.remove() };
}
