import type { FrameFilter, ScopeFilter } from '../core/scope.ts';
import type { TextAlign } from '../core/types.ts';
import { DEFAULTS } from './options.ts';
import type {
  AlignOptions,
  EdgeChoice,
  FitOptions,
  HugFillMode,
  HugFillOptions,
  SizingChoice,
  TextOptions,
} from './options.ts';

type Dict = Record<string, unknown>;

export function dict(value: unknown): Dict {
  return typeof value === 'object' && value !== null ? (value as Dict) : {};
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

const SCOPES: readonly ScopeFilter[] = ['everything', 'children-only', 'selection-only'];
const FRAMES: readonly FrameFilter[] = ['all', 'vertical', 'horizontal'];
const SIZINGS: readonly SizingChoice[] = ['keep', 'FIXED', 'HUG', 'FILL'];
const TEXT_ALIGNS: readonly (TextAlign | 'keep')[] = [
  'LEFT',
  'CENTER',
  'RIGHT',
  'JUSTIFIED',
  'keep',
];
const EDGES: readonly EdgeChoice[] = ['MIN', 'CENTER', 'MAX', 'keep'];

function hugFillMode(value: unknown): HugFillMode {
  const input = dict(value);
  if (input.kind !== 'custom') return { kind: 'auto' };
  return {
    kind: 'custom',
    x: oneOf(input.x, SIZINGS, 'keep'),
    y: oneOf(input.y, SIZINGS, 'keep'),
  };
}

export function sanitizeHugFill(raw: unknown): HugFillOptions {
  const input = dict(raw);
  return {
    scope: oneOf(input.scope, SCOPES, DEFAULTS['hug-fill'].scope),
    frames: oneOf(input.frames, FRAMES, DEFAULTS['hug-fill'].frames),
    mode: hugFillMode(input.mode),
  };
}

export function sanitizeFit(raw: unknown): FitOptions {
  const input = dict(raw);
  return {
    scope: oneOf(input.scope, SCOPES, DEFAULTS.fit.scope),
    width: bool(input.width, DEFAULTS.fit.width),
    height: bool(input.height, DEFAULTS.fit.height),
    constraints: oneOf(
      input.constraints,
      ['STRETCH', 'SCALE', 'keep'] as const,
      DEFAULTS.fit.constraints,
    ),
  };
}

export function sanitizeText(raw: unknown): TextOptions {
  const input = dict(raw);
  const align = oneOf(input.align, TEXT_ALIGNS, DEFAULTS.text.align);
  return {
    scope: oneOf(input.scope, SCOPES, DEFAULTS.text.scope),
    align,
    frame: bool(input.frame, DEFAULTS.text.frame) && align !== 'JUSTIFIED' && align !== 'keep',
    resize: oneOf(input.resize, ['hug', 'fill', 'fixed', 'keep'] as const, DEFAULTS.text.resize),
  };
}

export function sanitizeAlign(raw: unknown): AlignOptions {
  const input = dict(raw);
  return {
    scope: oneOf(input.scope, SCOPES, DEFAULTS.align.scope),
    h: oneOf(input.h, EDGES, DEFAULTS.align.h),
    v: oneOf(input.v, EDGES, DEFAULTS.align.v),
    spaceBetween: bool(input.spaceBetween, DEFAULTS.align.spaceBetween),
  };
}
