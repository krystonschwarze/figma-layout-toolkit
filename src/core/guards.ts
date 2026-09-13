import { isAutoLayoutFrame, isInsideInstance, isLayoutChild } from './classify.ts';
import type { Policy } from './policy.ts';
import type { SkipReason } from './report.ts';
import type { Axis, Sizing, TreeNode } from './types.ts';

export function writeBlocker(node: TreeNode, policy: Policy): SkipReason | null {
  if (policy.skipHidden && !node.visible) return 'hidden';
  if (policy.skipLocked && node.locked) return 'locked';
  return null;
}

export type WriteResult = 'changed' | 'unchanged' | 'rejected';

type Writable = {
  [K in keyof TreeNode]-?: TreeNode[K] extends string | number | undefined ? K : never;
}[keyof TreeNode];

/*
 * Layers inside instances (slot content, or component layers when the policy enters them) accept
 * overrides for most of these properties and silently keep their value for the rest, without
 * throwing. Reading back after the write is the only way to know which happened, so every write
 * goes through here.
 */
export function write<K extends Writable>(node: TreeNode, key: K, value: TreeNode[K]): WriteResult {
  if (node[key] === value) return 'unchanged';
  node[key] = value;
  return node[key] === value ? 'changed' : 'rejected';
}

export function rejectionReason(node: TreeNode): SkipReason {
  return isInsideInstance(node) ? 'not overridable' : 'write failed';
}

export function sizingOf(node: TreeNode, axis: Axis): Sizing | undefined {
  return axis === 'x' ? node.layoutSizingHorizontal : node.layoutSizingVertical;
}

/*
 * Figma rejects FILL on an axis where the parent hugs. Because hug & fill runs bottom up the parent
 * may not have been written yet, so its planned value is consulted before the current one.
 */
export function fillBlocker(
  node: TreeNode,
  axis: Axis,
  plannedParentSizing: (parent: TreeNode, axis: Axis) => Sizing | undefined,
): SkipReason | null {
  if (!isLayoutChild(node)) return 'not a layout child';
  const parent = node.parent;
  if (parent === null || !isAutoLayoutFrame(parent)) return 'not a layout child';
  const parentSizing = plannedParentSizing(parent, axis) ?? sizingOf(parent, axis);
  return parentSizing === 'HUG' ? 'parent hugs' : null;
}
