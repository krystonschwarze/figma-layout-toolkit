export interface Policy {
  readonly skipLocked: boolean;
  readonly skipHidden: boolean;
  readonly insideComponents: boolean;
}

export const DEFAULT_POLICY: Policy = {
  skipLocked: true,
  skipHidden: true,
  insideComponents: false,
};
