import type { Policy } from './policy.ts';
import type { TreeNode } from './types.ts';

export type FontLoader = (node: TreeNode) => Promise<boolean>;

export interface RunContext {
  readonly policy: Policy;
  readonly loadFonts: FontLoader;
  /* Called every few dozen nodes so the sandbox can hand control back to the window. */
  readonly tick?: () => Promise<void>;
}

export const YIELD_EVERY = 40;

export async function maybeYield(ctx: RunContext, visited: number): Promise<void> {
  if (ctx.tick !== undefined && visited % YIELD_EVERY === 0) await ctx.tick();
}
