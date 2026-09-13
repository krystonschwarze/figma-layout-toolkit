import type { Sizing, TextAlign } from './core/types.ts';
import { DEFAULT_SETTINGS } from './messages.ts';
import type { Action, Settings } from './messages.ts';
import type { Edge, OptionsByCommand } from './params/options.ts';
import { bool, dict, oneOf } from './params/sanitize.ts';

const KEY_SETTINGS = 'layout-toolkit.settings';
const LEGACY_KEY_SETTINGS = 'sizing-toolkit.settings';

export function sanitizeSettings(raw: unknown): Settings {
  const input = dict(raw);
  const policy = dict(input.policy);
  return {
    scope: oneOf(
      input.scope,
      ['everything', 'children-only', 'selection-only'] as const,
      DEFAULT_SETTINGS.scope,
    ),
    textFrame: bool(input.textFrame, DEFAULT_SETTINGS.textFrame),
    fitConstraints: oneOf(
      input.fitConstraints,
      ['STRETCH', 'SCALE', 'keep'] as const,
      DEFAULT_SETTINGS.fitConstraints,
    ),
    policy: {
      skipLocked: bool(policy.skipLocked, DEFAULT_SETTINGS.policy.skipLocked),
      skipHidden: bool(policy.skipHidden, DEFAULT_SETTINGS.policy.skipHidden),
      insideComponents: bool(policy.insideComponents, DEFAULT_SETTINGS.policy.insideComponents),
    },
  };
}

const SIZINGS: readonly Sizing[] = ['FIXED', 'HUG', 'FILL'];
const ALIGNS: readonly TextAlign[] = ['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED'];
const EDGES: readonly Edge[] = ['MIN', 'CENTER', 'MAX'];

/* An action arrives from the window as untyped JSON, so it is checked field by field. */
export function sanitizeAction(raw: unknown): Action | null {
  const input = dict(raw);
  switch (input.kind) {
    case 'sizing': {
      const axis = input.axis === 'x' || input.axis === 'y' ? input.axis : null;
      const value = oneOf(input.value, SIZINGS, 'FIXED');
      return axis === null || !SIZINGS.includes(input.value as Sizing)
        ? null
        : { kind: 'sizing', axis, value };
    }
    case 'sizing-auto':
      return { kind: 'sizing-auto' };
    case 'text-align':
      return ALIGNS.includes(input.align as TextAlign)
        ? { kind: 'text-align', align: input.align as TextAlign }
        : null;
    case 'text-resize':
      return input.resize === 'hug' || input.resize === 'fill' || input.resize === 'fixed'
        ? { kind: 'text-resize', resize: input.resize }
        : null;
    case 'align':
      return EDGES.includes(input.h as Edge) && EDGES.includes(input.v as Edge)
        ? { kind: 'align', h: input.h as Edge, v: input.v as Edge }
        : null;
    case 'align-space-between':
      return { kind: 'align-space-between' };
    case 'fit': {
      const width = input.width === true;
      const height = input.height === true;
      return width || height ? { kind: 'fit', width, height } : null;
    }
    default:
      return null;
  }
}

export type Plan =
  | { command: 'hug-fill'; options: OptionsByCommand['hug-fill'] }
  | { command: 'fit'; options: OptionsByCommand['fit'] }
  | { command: 'text'; options: OptionsByCommand['text'] }
  | { command: 'align'; options: OptionsByCommand['align'] };

export function planFor(action: Action, settings: Settings): Plan {
  const { scope } = settings;
  switch (action.kind) {
    case 'sizing':
      return {
        command: 'hug-fill',
        options: {
          scope,
          frames: 'all',
          mode: {
            kind: 'custom',
            x: action.axis === 'x' ? action.value : 'keep',
            y: action.axis === 'y' ? action.value : 'keep',
          },
        },
      };
    case 'sizing-auto':
      return { command: 'hug-fill', options: { scope, frames: 'all', mode: { kind: 'auto' } } };
    case 'text-align':
      return {
        command: 'text',
        options: { scope, align: action.align, frame: settings.textFrame, resize: 'keep' },
      };
    case 'text-resize':
      return {
        command: 'text',
        options: { scope, align: 'keep', frame: false, resize: action.resize },
      };
    case 'align':
      return {
        command: 'align',
        options: { scope, h: action.h, v: action.v, spaceBetween: false },
      };
    case 'align-space-between':
      return { command: 'align', options: { scope, h: 'keep', v: 'keep', spaceBetween: true } };
    case 'fit':
      return {
        command: 'fit',
        options: {
          scope,
          width: action.width,
          height: action.height,
          constraints: settings.fitConstraints,
        },
      };
  }
}

const SIZING_LABEL: Record<Sizing, string> = { HUG: 'Hug', FILL: 'Fill', FIXED: 'Fixed' };
const EDGE_LABEL: Record<Edge, [string, string]> = {
  MIN: ['left', 'top'],
  CENTER: ['center', 'center'],
  MAX: ['right', 'bottom'],
};

export function labelFor(action: Action): string {
  switch (action.kind) {
    case 'sizing':
      return `${SIZING_LABEL[action.value]} ${action.axis === 'x' ? 'width' : 'height'}`;
    case 'sizing-auto':
      return 'Auto sizing';
    case 'text-align':
      return `Text ${action.align.toLowerCase()}`;
    case 'text-resize':
      return `Text ${action.resize}`;
    case 'align':
      return `Align ${EDGE_LABEL[action.v][1]} ${EDGE_LABEL[action.h][0]}`;
    case 'align-space-between':
      return 'Space between';
    case 'fit':
      return action.width && action.height
        ? 'Fit to parent'
        : action.width
          ? 'Fit width'
          : 'Fit height';
  }
}

/* Settings stored under the plugin's former name are read once and moved over. */
export async function readSettings(): Promise<Settings> {
  try {
    const stored: unknown = await figma.clientStorage.getAsync(KEY_SETTINGS);
    if (stored !== undefined) return sanitizeSettings(stored);
    const legacy: unknown = await figma.clientStorage.getAsync(LEGACY_KEY_SETTINGS);
    if (legacy === undefined) return sanitizeSettings(undefined);
    const settings = sanitizeSettings(legacy);
    await figma.clientStorage.setAsync(KEY_SETTINGS, settings);
    await figma.clientStorage.deleteAsync(LEGACY_KEY_SETTINGS);
    return settings;
  } catch (error) {
    console.warn('Layout Toolkit: could not read settings', error);
    return sanitizeSettings(undefined);
  }
}

export async function writeSettings(settings: Settings): Promise<Settings> {
  const clean = sanitizeSettings(settings);
  try {
    await figma.clientStorage.setAsync(KEY_SETTINGS, clean);
  } catch (error) {
    console.warn('Layout Toolkit: could not store settings', error);
  }
  return clean;
}
