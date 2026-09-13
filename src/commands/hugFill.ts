import {
  canHug,
  flowAxis,
  isAutoLayoutFrame,
  isGridFrame,
  isLayoutChild,
  isText,
} from '../core/classify.ts';
import { maybeYield } from '../core/context.ts';
import type { RunContext } from '../core/context.ts';
import { fillBlocker, rejectionReason, write, writeBlocker } from '../core/guards.ts';
import { emptyReport, keptAsOneLayer, skip } from '../core/report.ts';
import type { Report } from '../core/report.ts';
import { bottomUp, collectScope, matchesFrameFilter } from '../core/scope.ts';
import type { Axis, Sizing, TreeNode } from '../core/types.ts';
import type { HugFillMode, HugFillOptions } from '../params/options.ts';

export type SizingPlan = Partial<Record<Axis, Sizing>>;

/*
 * Auto follows the parent's direction: hug along the axis the parent stacks on, fill across it.
 * Text never fills vertically, a text layer in a row that stretches to the row's height is not
 * what anyone means by it. Where the parent itself will hug that axis, Figma refuses fill, so the
 * child hugs too.
 */
export function autoPlan(node: TreeNode): SizingPlan | null {
  const parent = node.parent;
  if (parent === null || !isLayoutChild(node) || !canHug(node)) return null;
  const flow = flowAxis(parent.layoutMode);
  if (flow === null) return null;
  const cross: Axis = flow === 'x' ? 'y' : 'x';
  const plan: SizingPlan = { [flow]: 'HUG' };
  plan[cross] = isText(node) && cross === 'y' ? 'HUG' : 'FILL';
  return plan;
}

export function planFor(node: TreeNode, mode: HugFillMode): SizingPlan | null {
  if (mode.kind === 'auto') return autoPlan(node);
  const plan: SizingPlan = {};
  if (mode.x !== 'keep') plan.x = mode.x;
  if (mode.y !== 'keep') plan.y = mode.y;
  return plan;
}

function isCandidate(node: TreeNode, mode: HugFillMode): boolean {
  if (isAutoLayoutFrame(node) || isText(node) || isGridFrame(node)) return true;
  return mode.kind === 'custom' && isLayoutChild(node);
}

export async function runHugFill(
  roots: readonly TreeNode[],
  options: HugFillOptions,
  ctx: RunContext,
): Promise<Report> {
  const report = emptyReport();
  const { mode } = options;
  const scope = collectScope(roots, options.scope, ctx.policy.insideComponents);
  keptAsOneLayer(report, roots, scope, ctx.policy.insideComponents);
  const nodes = bottomUp(scope).filter(
    ({ node }) => isCandidate(node, mode) && matchesFrameFilter(node, options.frames),
  );

  const plans = new Map<string, SizingPlan>();
  for (const { node } of nodes) {
    const plan = planFor(node, mode);
    if (plan !== null) plans.set(node.id, plan);
  }
  const plannedParentSizing = (parent: TreeNode, axis: Axis): Sizing | undefined =>
    plans.get(parent.id)?.[axis];

  let visited = 0;
  for (const { node } of nodes) {
    await maybeYield(ctx, ++visited);
    const blocker = writeBlocker(node, ctx.policy);
    if (blocker !== null) {
      skip(report, blocker, node);
      continue;
    }
    if (isGridFrame(node) || (node.parent !== null && isGridFrame(node.parent))) {
      skip(report, 'grid layout', node);
      continue;
    }
    const plan = plans.get(node.id);
    if (plan === undefined) {
      if (mode.kind === 'auto' && !isLayoutChild(node)) report.unchanged += 1;
      else skip(report, 'not a layout child', node);
      continue;
    }
    if (isText(node) && !(await ctx.loadFonts(node))) {
      skip(report, 'missing font', node);
      continue;
    }

    let changed = false;
    for (const axis of ['x', 'y'] as const) {
      const target = plan[axis];
      if (target === undefined) continue;
      if (target === 'HUG' && !canHug(node)) {
        skip(report, 'cannot hug', node, axis);
        continue;
      }
      let value: Sizing = target;
      if (target === 'FILL') {
        const fillBlock = fillBlocker(node, axis, plannedParentSizing);
        if (fillBlock === 'parent hugs' && mode.kind === 'auto' && canHug(node)) {
          value = 'HUG';
          report.notes.push(`${node.name} (${axis}): parent hugs, falling back to hug`);
        } else if (fillBlock !== null) {
          skip(report, fillBlock, node, axis);
          continue;
        }
      }
      try {
        const result =
          axis === 'x'
            ? write(node, 'layoutSizingHorizontal', value)
            : write(node, 'layoutSizingVertical', value);
        if (result === 'changed') changed = true;
        else if (result === 'rejected') skip(report, rejectionReason(node), node, axis);
      } catch (error) {
        skip(report, 'write failed', node, String(error));
      }
    }
    if (changed) report.changed += 1;
    else report.unchanged += 1;
  }

  return report;
}
