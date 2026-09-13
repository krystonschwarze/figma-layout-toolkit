import type { TreeNode } from './types.ts';

export type ScopeFilter = 'everything' | 'selection-only' | 'children-only';
export type FrameFilter = 'all' | 'vertical' | 'horizontal';

export interface ScopedNode<T extends TreeNode = TreeNode> {
  readonly node: T;
  readonly depth: number;
  readonly isRoot: boolean;
  /* An instance whose own layers were not entered, only its slots were. */
  readonly boundary: boolean;
}

/*
 * Roots are treated independently, and a node reached through two selected roots (a frame and one of
 * its children) is collected once, at the depth of the outer root.
 *
 * An instance is a boundary: what a component brings along hangs directly under it, what the user
 * put in hangs under a SLOT. So below an instance only slots are entered, unless the policy asks for
 * the component's own layers too.
 */
export function collectScope<T extends TreeNode>(
  roots: readonly T[],
  filter: ScopeFilter = 'everything',
  insideComponents = false,
): ScopedNode<T>[] {
  const seen = new Set<string>();
  const out: ScopedNode<T>[] = [];

  function visit(node: T, depth: number, isRoot: boolean): void {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    const boundary = node.type === 'INSTANCE' && !insideComponents;
    const include =
      filter === 'selection-only' ? isRoot : filter === 'children-only' ? !isRoot : true;
    if (include) out.push({ node, depth, isRoot, boundary });
    if (filter === 'selection-only') return;
    for (const child of node.children ?? []) {
      if (boundary && child.type !== 'SLOT') continue;
      visit(child as T, depth + 1, false);
    }
  }

  for (const root of roots) visit(root, 0, true);
  return out;
}

export function bottomUp<T extends TreeNode>(scope: readonly ScopedNode<T>[]): ScopedNode<T>[] {
  return [...scope].sort((a, b) => b.depth - a.depth);
}

export function topDown<T extends TreeNode>(scope: readonly ScopedNode<T>[]): ScopedNode<T>[] {
  return [...scope].sort((a, b) => a.depth - b.depth);
}

export function matchesFrameFilter(node: TreeNode, filter: FrameFilter): boolean {
  if (filter === 'vertical') return node.layoutMode === 'VERTICAL';
  if (filter === 'horizontal') return node.layoutMode === 'HORIZONTAL';
  return true;
}
