import type { FrameFilter, ScopeFilter } from '../core/scope.ts';
import type { Sizing, TextAlign } from '../core/types.ts';

export type Command = 'hug-fill' | 'fit' | 'text' | 'align' | 'border';

export type SizingChoice = Sizing | 'keep';
export type HugFillMode = { kind: 'auto' } | { kind: 'custom'; x: SizingChoice; y: SizingChoice };
export interface HugFillOptions {
  scope: ScopeFilter;
  frames: FrameFilter;
  mode: HugFillMode;
}

export type FitConstraints = 'STRETCH' | 'SCALE' | 'keep';
export interface FitOptions {
  scope: ScopeFilter;
  width: boolean;
  height: boolean;
  constraints: FitConstraints;
}

export type TextResizeChoice = 'hug' | 'fill' | 'fixed' | 'keep';
export interface TextOptions {
  scope: ScopeFilter;
  align: TextAlign | 'keep';
  frame: boolean;
  resize: TextResizeChoice;
}

export type Edge = 'MIN' | 'CENTER' | 'MAX';
export type EdgeChoice = Edge | 'keep';
export interface AlignOptions {
  scope: ScopeFilter;
  h: EdgeChoice;
  v: EdgeChoice;
  spaceBetween: boolean;
}

export interface BorderOptions {
  scope: ScopeFilter;
  included: boolean;
  skipComponents: boolean;
  /* A layer chosen by hand is worked on even when the skip would otherwise guard it. */
  exemptRoots: boolean;
}

export interface OptionsByCommand {
  'hug-fill': HugFillOptions;
  fit: FitOptions;
  text: TextOptions;
  align: AlignOptions;
  border: BorderOptions;
}

export const DEFAULTS: OptionsByCommand = {
  'hug-fill': { scope: 'everything', frames: 'all', mode: { kind: 'auto' } },
  fit: { scope: 'everything', width: true, height: true, constraints: 'STRETCH' },
  text: { scope: 'everything', align: 'LEFT', frame: true, resize: 'keep' },
  align: { scope: 'everything', h: 'MIN', v: 'MIN', spaceBetween: false },
  border: { scope: 'everything', included: true, skipComponents: true, exemptRoots: true },
};
