import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SETTINGS } from './messages.ts';
import { labelFor, planFor, sanitizeAction, sanitizeSettings } from './settings.ts';

test('sanitizeSettings falls back to the defaults for garbage and keeps valid values', () => {
  assert.deepEqual(sanitizeSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(sanitizeSettings({ scope: 'nope', policy: 3 }), DEFAULT_SETTINGS);
  assert.deepEqual(
    sanitizeSettings({
      scope: 'children-only',
      textFrame: false,
      fitConstraints: 'SCALE',
      policy: { skipLocked: false },
    }),
    {
      scope: 'children-only',
      textFrame: false,
      fitConstraints: 'SCALE',
      policy: { skipLocked: false, skipHidden: true, insideComponents: false },
    },
  );
});

test('sanitizeAction accepts every button and rejects the rest', () => {
  assert.deepEqual(sanitizeAction({ kind: 'sizing', axis: 'x', value: 'FILL' }), {
    kind: 'sizing',
    axis: 'x',
    value: 'FILL',
  });
  assert.equal(sanitizeAction({ kind: 'sizing', axis: 'z', value: 'FILL' }), null);
  assert.equal(sanitizeAction({ kind: 'sizing', axis: 'x', value: 'BIG' }), null);
  assert.deepEqual(sanitizeAction({ kind: 'text-align', align: 'CENTER' }), {
    kind: 'text-align',
    align: 'CENTER',
  });
  assert.equal(sanitizeAction({ kind: 'text-align', align: 'keep' }), null);
  assert.deepEqual(sanitizeAction({ kind: 'align', h: 'MAX', v: 'MIN' }), {
    kind: 'align',
    h: 'MAX',
    v: 'MIN',
  });
  assert.equal(sanitizeAction({ kind: 'fit', width: false, height: false }), null);
  assert.equal(sanitizeAction({ kind: 'nope' }), null);
});

test('planFor maps a button to one command with fixed options and the shared scope', () => {
  const settings = sanitizeSettings({
    scope: 'selection-only',
    textFrame: true,
    fitConstraints: 'keep',
  });
  assert.deepEqual(planFor({ kind: 'sizing', axis: 'y', value: 'HUG' }, settings), {
    command: 'hug-fill',
    options: {
      scope: 'selection-only',
      frames: 'all',
      mode: { kind: 'custom', x: 'keep', y: 'HUG' },
    },
  });
  assert.deepEqual(planFor({ kind: 'text-align', align: 'CENTER' }, settings), {
    command: 'text',
    options: { scope: 'selection-only', align: 'CENTER', frame: true, resize: 'keep' },
  });
  assert.deepEqual(planFor({ kind: 'align-space-between' }, settings), {
    command: 'align',
    options: { scope: 'selection-only', h: 'keep', v: 'keep', spaceBetween: true },
  });
  assert.deepEqual(planFor({ kind: 'fit', width: true, height: false }, settings), {
    command: 'fit',
    options: { scope: 'selection-only', width: true, height: false, constraints: 'keep' },
  });
});

test('labelFor speaks in the words of the button', () => {
  assert.equal(labelFor({ kind: 'sizing', axis: 'x', value: 'FILL' }), 'Fill width');
  assert.equal(labelFor({ kind: 'align', h: 'MAX', v: 'MIN' }), 'Align top right');
  assert.equal(labelFor({ kind: 'fit', width: true, height: true }), 'Fit to parent');
  assert.equal(labelFor({ kind: 'text-resize', resize: 'fill' }), 'Text fill');
});
