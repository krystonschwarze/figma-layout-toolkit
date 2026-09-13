import { isAutoLayoutFrame, isFrameLike, isGridFrame } from '../core/classify.ts';
import { maybeYield } from '../core/context.ts';
import type { RunContext } from '../core/context.ts';
import { rejectionReason, write, writeBlocker } from '../core/guards.ts';
import { emptyReport, keptAsOneLayer, skip } from '../core/report.ts';
import type { Report } from '../core/report.ts';
import { collectScope, topDown } from '../core/scope.ts';
import type { CounterAlign, LayoutMode, PrimaryAlign, TreeNode } from '../core/types.ts';
import type { AlignOptions } from '../params/options.ts';

export interface AxisAlignment {
  primary: PrimaryAlign | undefined;
  counter: CounterAlign | undefined;
}

/*
 * The picker describes horizontal and vertical edges, but the properties are named after the
 * frame's primary and counter axis, so the mapping flips with layoutMode. Space between replaces
 * the primary axis edge and only exists there. An axis on keep is not written.
 */
export function axisAlignment(
  layoutMode: LayoutMode,
  options: Pick<AlignOptions, 'h' | 'v' | 'spaceBetween'>,
): AxisAlignment {
  const horizontal = layoutMode === 'HORIZONTAL';
  const primaryEdge = horizontal ? options.h : options.v;
  const counterEdge = horizontal ? options.v : options.h;
  return {
    primary: options.spaceBetween
      ? 'SPACE_BETWEEN'
      : primaryEdge === 'keep'
        ? undefined
        : primaryEdge,
    counter: counterEdge === 'keep' ? undefined : counterEdge,
  };
}

export async function runAlign(
  roots: readonly TreeNode[],
  options: AlignOptions,
  ctx: RunContext,
): Promise<Report> {
  const report = emptyReport();

  const scope = collectScope(roots, options.scope, ctx.policy.insideComponents);
  keptAsOneLayer(report, roots, scope, ctx.policy.insideComponents);
  let visited = 0;
  for (const { node, boundary } of topDown(scope)) {
    await maybeYield(ctx, ++visited);
    /* Aligning an instance root arranges the component's own children, that stays with the component. */
    if (!isFrameLike(node) || boundary) continue;
    if (isGridFrame(node)) {
      skip(report, 'grid layout', node);
      continue;
    }
    if (!isAutoLayoutFrame(node) || node.layoutMode === undefined) {
      skip(report, 'no auto layout', node);
      continue;
    }
    const blocker = writeBlocker(node, ctx.policy);
    if (blocker !== null) {
      skip(report, blocker, node);
      continue;
    }

    const target = axisAlignment(node.layoutMode, options);
    try {
      const results = [];
      if (target.primary !== undefined) {
        results.push(write(node, 'primaryAxisAlignItems', target.primary));
      }
      if (target.counter !== undefined) {
        results.push(write(node, 'counterAxisAlignItems', target.counter));
      }
      if (results.includes('rejected')) skip(report, rejectionReason(node), node);
      else if (results.includes('changed')) report.changed += 1;
      else report.unchanged += 1;
    } catch (error) {
      skip(report, 'write failed', node, String(error));
    }
  }

  return report;
}
