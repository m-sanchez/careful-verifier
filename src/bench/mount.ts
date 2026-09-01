/** The page layer: tamper chips, a draft editor, a run button, and a
 * checkpoint rail. Framework-free DOM, styled through class names only
 * (prefix `tb-`), so the host page owns the look. The widget makes no
 * network calls; whatever it proves, it proves locally. */

import { Bench } from './bench.ts';
import type { BenchConfig, Report } from './bench.ts';

export interface MountOptions {
  /** heading above the bench */
  title?: string;
  /** shown when the draft JSON in the editor does not parse */
  parseErrorText?: string;
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

  const renderReport = (report: Report | null) => {
    rail.textContent = '';
    outcome.textContent = '';
    if (!report) return;
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
  };

  runButton.addEventListener('click', () => {
    try {
      const edited = JSON.parse(editor.value) as D;
      if (canonical(edited) !== canonical(bench.draft)) bench.edit(edited);
    } catch {
      status.textContent = opts.parseErrorText ?? 'draft is not valid JSON; fix it or reset';
      return;
    }
    bench.run();
    refresh();
  });

  refresh();
  container.appendChild(root);
  return { bench, refresh, destroy: () => root.remove() };
}
