import { isAutoLayoutFrame, isText } from '../core/classify.ts';
import { maybeYield } from '../core/context.ts';
import type { RunContext } from '../core/context.ts';
import { fillBlocker, rejectionReason, write, writeBlocker } from '../core/guards.ts';
import type { WriteResult } from '../core/guards.ts';
import { emptyReport, keptAsOneLayer, skip } from '../core/report.ts';
import type { Report } from '../core/report.ts';
import { collectScope, topDown } from '../core/scope.ts';
import type { TextAlign, TreeNode } from '../core/types.ts';
import type { Edge, TextOptions } from '../params/options.ts';

const EDGE_OF_ALIGN: Record<Exclude<TextAlign, 'JUSTIFIED'>, Edge> = {
  LEFT: 'MIN',
  CENTER: 'CENTER',
  RIGHT: 'MAX',
};

/* The horizontal component lands on whichever axis property is horizontal for this frame. */
export function alignFrameHorizontally(frame: TreeNode, edge: Edge): WriteResult {
  return frame.layoutMode === 'HORIZONTAL'
    ? write(frame, 'primaryAxisAlignItems', edge)
    : write(frame, 'counterAxisAlignItems', edge);
}

export async function runText(
  roots: readonly TreeNode[],
  options: TextOptions,
  ctx: RunContext,
): Promise<Report> {
  const report = emptyReport();
  const framesDone = new Set<string>();
  const { align, frame } = options;

  const scope = collectScope(roots, options.scope, ctx.policy.insideComponents);
  keptAsOneLayer(report, roots, scope, ctx.policy.insideComponents);
  let visited = 0;
  for (const { node } of topDown(scope)) {
    await maybeYield(ctx, ++visited);
    if (!isText(node)) continue;
    const blocker = writeBlocker(node, ctx.policy);
    if (blocker !== null) {
      skip(report, blocker, node);
      continue;
    }
    if (!(await ctx.loadFonts(node))) {
      skip(report, 'missing font', node);
      continue;
    }

    const results: WriteResult[] = [];
    try {
      if (align !== 'keep') results.push(write(node, 'textAlignHorizontal', align));

      if (options.resize === 'hug') {
        results.push(write(node, 'textAutoResize', 'WIDTH_AND_HEIGHT'));
      } else if (options.resize === 'fixed') {
        results.push(write(node, 'textAutoResize', 'NONE'));
      } else if (options.resize === 'fill') {
        results.push(write(node, 'textAutoResize', 'HEIGHT'));
        const fillBlock = fillBlocker(node, 'x', () => undefined);
        if (fillBlock !== null) skip(report, fillBlock, node);
        else results.push(write(node, 'layoutSizingHorizontal', 'FILL'));
      }
    } catch (error) {
      skip(report, 'write failed', node, String(error));
      continue;
    }
    if (results.includes('rejected')) skip(report, rejectionReason(node), node);
    else if (results.includes('changed')) report.changed += 1;
    else report.unchanged += 1;

    const parent = node.parent;
    if (!frame || align === 'keep' || align === 'JUSTIFIED' || parent === null) continue;
    if (framesDone.has(parent.id)) continue;
    framesDone.add(parent.id);
    if (!isAutoLayoutFrame(parent)) {
      skip(report, 'no auto layout', parent);
      continue;
    }
    const parentBlocker = writeBlocker(parent, ctx.policy);
    if (parentBlocker !== null) {
      skip(report, parentBlocker, parent);
      continue;
    }
    try {
      const result = alignFrameHorizontally(parent, EDGE_OF_ALIGN[align]);
      if (result === 'changed') report.changed += 1;
      else if (result === 'rejected') skip(report, rejectionReason(parent), parent);
    } catch (error) {
      skip(report, 'write failed', parent, String(error));
    }
  }

  return report;
}
