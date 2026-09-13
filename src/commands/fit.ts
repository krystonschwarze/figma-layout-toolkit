import { isFreeChild, isInsideInstance, isText } from '../core/classify.ts';
import { maybeYield } from '../core/context.ts';
import type { RunContext } from '../core/context.ts';
import { rejectionReason, writeBlocker } from '../core/guards.ts';
import { emptyReport, keptAsOneLayer, skip } from '../core/report.ts';
import type { Report } from '../core/report.ts';
import { collectScope, topDown } from '../core/scope.ts';
import type { TreeNode } from '../core/types.ts';
import type { FitOptions } from '../params/options.ts';

function hasVisibleStroke(node: TreeNode): boolean {
  return (node.strokes ?? []).some((stroke) => stroke.visible !== false);
}

export async function runFit(
  roots: readonly TreeNode[],
  options: FitOptions,
  ctx: RunContext,
): Promise<Report> {
  const report = emptyReport();
  const fitX = options.width;
  const fitY = options.height;
  if (!fitX && !fitY) return report;

  const scope = collectScope(roots, options.scope, ctx.policy.insideComponents);
  keptAsOneLayer(report, roots, scope, ctx.policy.insideComponents);
  let visited = 0;
  for (const { node } of topDown(scope)) {
    await maybeYield(ctx, ++visited);
    if (!isFreeChild(node)) continue;
    const parent = node.parent;
    if (parent === null || parent.width === undefined || parent.height === undefined) {
      skip(report, 'no parent frame', node);
      continue;
    }
    const blocker = writeBlocker(node, ctx.policy);
    if (blocker !== null) {
      skip(report, blocker, node);
      continue;
    }
    if ((node.rotation ?? 0) !== 0) {
      skip(report, 'rotated', node);
      continue;
    }
    if (node.resize === undefined || node.width === undefined || node.height === undefined) {
      skip(report, 'write failed', node, 'not resizable');
      continue;
    }
    if (node.type === 'LINE' && !fitX) {
      skip(report, 'line', node);
      continue;
    }
    if (isText(node) && !(await ctx.loadFonts(node))) {
      skip(report, 'missing font', node);
      continue;
    }

    const targetWidth = fitX ? parent.width : node.width;
    const targetHeight = node.type === 'LINE' ? 0 : fitY ? parent.height : node.height;

    try {
      if (isText(node)) node.textAutoResize = fitX && !fitY ? 'HEIGHT' : 'NONE';
      if (fitX) node.x = 0;
      if (fitY) node.y = 0;
      node.resize(targetWidth, targetHeight);
      if (options.constraints !== 'keep' && node.constraints !== undefined) {
        node.constraints = {
          horizontal: fitX ? options.constraints : node.constraints.horizontal,
          vertical: fitY ? options.constraints : node.constraints.vertical,
        };
      }
    } catch (error) {
      skip(report, 'write failed', node, String(error));
      continue;
    }

    const moved = (!fitX || node.x === 0) && (!fitY || node.y === 0);
    const sized = node.width === targetWidth && node.height === targetHeight;
    if (!moved || (!sized && isInsideInstance(node))) {
      skip(report, rejectionReason(node), node, `kept ${node.width}×${node.height}`);
      continue;
    }
    report.changed += 1;
    if (!sized) skip(report, 'clamped by min or max', node, `is ${node.width}×${node.height}`);
    if (node.strokeAlign !== undefined && node.strokeAlign !== 'INSIDE' && hasVisibleStroke(node)) {
      report.notes.push(
        `${node.name}: stroke is ${node.strokeAlign.toLowerCase()}, it reaches past the frame`,
      );
    }
  }

  return report;
}
