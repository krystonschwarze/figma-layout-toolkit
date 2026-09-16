import { hasLayout, isComponentLike, isFrameLike } from '../core/classify.ts';
import { maybeYield } from '../core/context.ts';
import type { RunContext } from '../core/context.ts';
import { rejectionReason, write, writeBlocker } from '../core/guards.ts';
import { emptyReport, keptAsOneLayer, skip } from '../core/report.ts';
import type { Report } from '../core/report.ts';
import { collectScope, topDown } from '../core/scope.ts';
import type { TreeNode } from '../core/types.ts';
import type { BorderOptions } from '../params/options.ts';

/*
 * Only a frame that carries a visible stroke changes size from the write, and those are the ones
 * worth pointing at afterwards. A stroke paint with weight 0 draws nothing, and Figma hands out
 * figma.mixed for the weight when the four sides differ, which counts as bordered.
 */
export function hasVisibleBorder(node: TreeNode): boolean {
  const strokes = node.strokes ?? [];
  if (!strokes.some((stroke) => stroke.visible !== false)) return false;
  const weight = node.strokeWeight;
  return typeof weight === 'number' ? weight > 0 : weight !== undefined;
}

export async function runBorder(
  roots: readonly TreeNode[],
  options: BorderOptions,
  ctx: RunContext,
): Promise<Report> {
  const report = emptyReport();

  const scope = collectScope(
    roots,
    options.scope,
    ctx.policy.insideComponents,
    options.skipComponents,
    options.exemptRoots,
  );
  let visited = 0;
  for (const { node, exempt } of topDown(scope)) {
    await maybeYield(ctx, ++visited);
    if (options.skipComponents && !exempt && isComponentLike(node)) {
      skip(report, 'component or instance', node);
      continue;
    }
    if (!isFrameLike(node)) continue;
    /* Figma throws on a frame without layout rather than ignoring the write, so it is guarded. */
    if (!hasLayout(node)) {
      skip(report, 'no layout', node);
      continue;
    }
    const blocker = writeBlocker(node, ctx.policy);
    if (blocker !== null) {
      skip(report, blocker, node);
      continue;
    }

    try {
      const result = write(node, 'strokesIncludedInLayout', options.included);
      if (result === 'rejected') {
        skip(report, rejectionReason(node), node);
      } else if (result === 'changed') {
        report.changed += 1;
        if (hasVisibleBorder(node)) report.bordered.push({ id: node.id, name: node.name });
      } else {
        report.unchanged += 1;
      }
    } catch (error) {
      skip(report, 'write failed', node, String(error));
    }
  }

  /*
   * Runs after the loop: an instance that the skip already reported must not be listed a second
   * time as kept as one layer.
   */
  const reported = new Set((report.skipped.get('component or instance') ?? []).map((l) => l.id));
  keptAsOneLayer(report, roots, scope, ctx.policy.insideComponents);
  report.instances = report.instances.filter((layer) => !reported.has(layer.id));

  return report;
}
