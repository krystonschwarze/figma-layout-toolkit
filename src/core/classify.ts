import type { Axis, LayoutMode, TreeNode } from './types.ts';

/* A slot is a frame with a component property attached, it lays out its children like any other. */
const FRAME_TYPES: ReadonlySet<string> = new Set(['FRAME', 'COMPONENT', 'INSTANCE', 'SLOT']);

export function isFrameLike(node: TreeNode): boolean {
  return FRAME_TYPES.has(node.type);
}

export function isComponentLike(node: TreeNode): boolean {
  return node.type === 'COMPONENT' || node.type === 'COMPONENT_SET' || node.type === 'INSTANCE';
}

export function isText(node: TreeNode): boolean {
  return node.type === 'TEXT';
}

/* Grid layout has no flow axis, so it is deliberately not an auto layout frame here. */
export function isAutoLayoutFrame(node: TreeNode): boolean {
  return isFrameLike(node) && (node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL');
}

export function isGridFrame(node: TreeNode): boolean {
  return isFrameLike(node) && node.layoutMode === 'GRID';
}

/* Any layout that reserves space, so unlike isAutoLayoutFrame this includes grid. */
export function hasLayout(node: TreeNode): boolean {
  return isFrameLike(node) && node.layoutMode !== undefined && node.layoutMode !== 'NONE';
}

export function isLayoutChild(node: TreeNode): boolean {
  const parent = node.parent;
  if (parent === null || !isAutoLayoutFrame(parent)) return false;
  return node.layoutPositioning !== 'ABSOLUTE';
}

/* A child that frames position by constraints: inside a plain frame, or absolute inside auto layout. */
export function isFreeChild(node: TreeNode): boolean {
  const parent = node.parent;
  if (parent === null || !isFrameLike(parent)) return false;
  if (parent.layoutMode === 'NONE' || parent.layoutMode === undefined) return true;
  return isAutoLayoutFrame(parent) && node.layoutPositioning === 'ABSOLUTE';
}

export function canHug(node: TreeNode): boolean {
  return isAutoLayoutFrame(node) || isText(node);
}

export function flowAxis(layoutMode: LayoutMode | undefined): Axis | null {
  if (layoutMode === 'HORIZONTAL') return 'x';
  if (layoutMode === 'VERTICAL') return 'y';
  return null;
}

export function isInsideInstance(node: TreeNode): boolean {
  for (let cursor = node.parent; cursor !== null; cursor = cursor.parent) {
    if (cursor.type === 'INSTANCE') return true;
  }
  return false;
}

export function depthOf(node: TreeNode): number {
  let depth = 0;
  for (let cursor = node.parent; cursor !== null; cursor = cursor.parent) depth += 1;
  return depth;
}
