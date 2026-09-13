import type { RunContext } from './context.ts';
import { DEFAULT_POLICY } from './policy.ts';
import type { Policy } from './policy.ts';
import type { TreeNode } from './types.ts';

export function ctx(
  overrides: Partial<Policy> = {},
  loadFonts: (node: TreeNode) => Promise<boolean> = () => Promise.resolve(true),
): RunContext {
  return { policy: { ...DEFAULT_POLICY, ...overrides }, loadFonts };
}
