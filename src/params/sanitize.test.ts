import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULTS } from './options.ts';
import { sanitizeAlign, sanitizeFit, sanitizeHugFill, sanitizeText } from './sanitize.ts';

test('garbage falls back to the defaults per command', () => {
  assert.deepEqual(sanitizeHugFill(undefined), DEFAULTS['hug-fill']);
  assert.deepEqual(sanitizeHugFill({ mode: 'Hug X', scope: 'nope' }), DEFAULTS['hug-fill']);
  assert.deepEqual(sanitizeFit('x'), DEFAULTS.fit);
  assert.deepEqual(sanitizeText({ align: 'UP' }), DEFAULTS.text);
  assert.deepEqual(sanitizeAlign({ h: 'LEFT' }), DEFAULTS.align);
});

test('valid values survive, unknown custom axes become keep', () => {
  assert.deepEqual(sanitizeHugFill({ mode: { kind: 'custom', x: 'FILL', y: 'nope' } }), {
    scope: 'everything',
    frames: 'all',
    mode: { kind: 'custom', x: 'FILL', y: 'keep' },
  });
  assert.deepEqual(sanitizeFit({ scope: 'children-only', height: false, constraints: 'SCALE' }), {
    scope: 'children-only',
    width: true,
    height: false,
    constraints: 'SCALE',
  });
  assert.deepEqual(sanitizeText({ align: 'CENTER', frame: true, resize: 'fill' }), {
    scope: 'everything',
    align: 'CENTER',
    frame: true,
    resize: 'fill',
  });
  assert.deepEqual(sanitizeAlign({ h: 'MAX', v: 'CENTER', spaceBetween: true }), {
    scope: 'everything',
    h: 'MAX',
    v: 'CENTER',
    spaceBetween: true,
  });
});

test('justify and keep never pull the frame along', () => {
  assert.equal(sanitizeText({ align: 'JUSTIFIED', frame: true }).frame, false);
  assert.equal(sanitizeText({ align: 'keep', frame: true }).frame, false);
});
