import type { Policy } from './core/policy.ts';
import type { LayerRef } from './core/report.ts';
import type { ScopeFilter } from './core/scope.ts';
import type { Axis, Sizing, TextAlign } from './core/types.ts';
import type { Edge, FitConstraints, TextResizeChoice } from './params/options.ts';

export type Action =
  | { kind: 'sizing'; axis: Axis; value: Sizing }
  | { kind: 'sizing-auto' }
  | { kind: 'text-align'; align: TextAlign }
  | { kind: 'text-resize'; resize: Exclude<TextResizeChoice, 'keep'> }
  | { kind: 'align'; h: Edge; v: Edge }
  | { kind: 'align-space-between' }
  | { kind: 'fit'; width: boolean; height: boolean };

export interface Settings {
  scope: ScopeFilter;
  textFrame: boolean;
  fitConstraints: FitConstraints;
  policy: Policy;
}

export const DEFAULT_SETTINGS: Settings = {
  scope: 'everything',
  textFrame: true,
  fitConstraints: 'STRETCH',
  policy: { skipLocked: true, skipHidden: true, insideComponents: false },
};

export interface SelectionState {
  count: number;
  name: string;
}

export interface SkippedGroup {
  reason: string;
  layers: LayerRef[];
}

export interface ReportSummary {
  label: string;
  changed: number;
  unchanged: number;
  skipped: SkippedGroup[];
  instances: LayerRef[];
}

export type UiMessage =
  | { type: 'run'; action: Action; settings: Settings }
  | { type: 'save-settings'; settings: Settings }
  | { type: 'select'; id: string };

export type PluginMessage =
  | { type: 'init'; settings: Settings; selection: SelectionState }
  | { type: 'selection'; selection: SelectionState }
  | { type: 'running' }
  | { type: 'report'; report: ReportSummary }
  | { type: 'error'; message: string };
