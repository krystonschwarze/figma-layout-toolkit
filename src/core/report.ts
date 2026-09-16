export type SkipReason =
  | 'not overridable'
  | 'locked'
  | 'hidden'
  | 'no auto layout'
  | 'grid layout'
  | 'component or instance'
  | 'no layout'
  | 'not a layout child'
  | 'parent hugs'
  | 'cannot hug'
  | 'rotated'
  | 'missing font'
  | 'no parent frame'
  | 'line'
  | 'write failed'
  | 'clamped by min or max';

export interface LayerRef {
  readonly id: string;
  readonly name: string;
}

export interface Report {
  changed: number;
  unchanged: number;
  skipped: Map<SkipReason, LayerRef[]>;
  /* Instances kept as one layer: written where the row applies, never entered below the slots. */
  instances: LayerRef[];
  /* Frames that visibly change size from the write, because they carry a border. */
  bordered: LayerRef[];
  notes: string[];
}

export function emptyReport(): Report {
  return { changed: 0, unchanged: 0, skipped: new Map(), instances: [], bordered: [], notes: [] };
}

/* A selected instance under Children is not in the scope but still the reason its own layers stayed. */
export function keptAsOneLayer(
  report: Report,
  roots: readonly (LayerRef & { type: string })[],
  scope: readonly { node: LayerRef; boundary: boolean }[],
  insideComponents: boolean,
): void {
  if (insideComponents) return;
  const boundaries = [
    ...roots.filter((root) => root.type === 'INSTANCE'),
    ...scope.filter((entry) => entry.boundary).map((entry) => entry.node),
  ];
  for (const node of boundaries) {
    if (!report.instances.some((l) => l.id === node.id)) {
      report.instances.push({ id: node.id, name: node.name });
    }
  }
}

export function skip(report: Report, reason: SkipReason, layer: LayerRef, detail?: string): void {
  const layers = report.skipped.get(reason) ?? [];
  if (!layers.some((l) => l.id === layer.id)) layers.push({ id: layer.id, name: layer.name });
  report.skipped.set(reason, layers);
  report.notes.push(`${reason}: ${layer.name}${detail === undefined ? '' : ` (${detail})`}`);
}

export function merge(into: Report, from: Report): Report {
  into.changed += from.changed;
  into.unchanged += from.unchanged;
  for (const [reason, layers] of from.skipped) {
    const existing = into.skipped.get(reason) ?? [];
    for (const layer of layers) {
      if (!existing.some((l) => l.id === layer.id)) existing.push(layer);
    }
    into.skipped.set(reason, existing);
  }
  for (const layer of from.instances) {
    if (!into.instances.some((l) => l.id === layer.id)) into.instances.push(layer);
  }
  for (const layer of from.bordered) {
    if (!into.bordered.some((l) => l.id === layer.id)) into.bordered.push(layer);
  }
  into.notes.push(...from.notes);
  return into;
}

export function skippedCount(report: Report): number {
  let total = 0;
  for (const layers of report.skipped.values()) total += layers.length;
  return total;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export function formatReport(report: Report): string {
  const skipped = skippedCount(report);
  if (report.changed === 0 && skipped === 0) {
    return report.unchanged > 0 ? 'Nothing to change, everything already matched' : 'Nothing to do';
  }
  const parts = [`${plural(report.changed, 'layer')} changed`];
  if (skipped > 0) parts.push(`${skipped} skipped`);
  if (report.instances.length > 0) {
    parts.push(`${plural(report.instances.length, 'instance')} as one layer`);
  }
  return parts.join(' · ');
}
