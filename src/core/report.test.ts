import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyReport, formatReport, merge, skip, skippedCount } from './report.ts';

const layer = (id: string) => ({ id, name: `layer ${id}` });

test('skip collects layers per reason once and keeps a note with the detail', () => {
  const report = emptyReport();
  skip(report, 'locked', layer('a'));
  skip(report, 'locked', layer('a'), 'x');
  skip(report, 'locked', layer('b'));
  assert.equal(report.skipped.get('locked')?.length, 2);
  assert.deepEqual(report.notes, ['locked: layer a', 'locked: layer a (x)', 'locked: layer b']);
});

test('formatReport builds the summary line', () => {
  const report = emptyReport();
  report.changed = 42;
  skip(report, 'not overridable', layer('a'));
  skip(report, 'not overridable', layer('b'));
  skip(report, 'locked', layer('c'));
  assert.equal(skippedCount(report), 3);
  assert.equal(formatReport(report), '42 layers changed · 3 skipped');
});

test('formatReport speaks plainly when nothing happened', () => {
  assert.equal(formatReport(emptyReport()), 'Nothing to do');
  const matched = emptyReport();
  matched.unchanged = 3;
  assert.equal(formatReport(matched), 'Nothing to change, everything already matched');
  const one = emptyReport();
  one.changed = 1;
  assert.equal(formatReport(one), '1 layer changed');
});

test('merge adds counts, unions layers and keeps notes', () => {
  const a = emptyReport();
  a.changed = 1;
  skip(a, 'locked', layer('x'));
  const b = emptyReport();
  b.changed = 2;
  skip(b, 'locked', layer('x'));
  skip(b, 'locked', layer('y'));
  skip(b, 'rotated', layer('z'));
  merge(a, b);
  assert.equal(a.changed, 3);
  assert.equal(a.skipped.get('locked')?.length, 2);
  assert.equal(a.skipped.get('rotated')?.length, 1);
  assert.equal(a.notes.length, 4);
});
