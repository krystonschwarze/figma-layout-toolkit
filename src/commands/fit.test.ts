import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ctx } from '../core/ctx.test-helper.ts';
import { fake, frame, page, rect, row, text } from '../core/fake.test-helper.ts';
import type { FakeNode } from '../core/fake.test-helper.ts';
import type { FitOptions } from '../params/options.ts';
import { runFit } from './fit.ts';

function fit(overrides: Partial<FitOptions> = {}): FitOptions {
  return { scope: 'everything', width: true, height: true, constraints: 'STRETCH', ...overrides };
}

function sized(node: FakeNode, x: number, y: number, w: number, h: number): FakeNode {
  node.x = x;
  node.y = y;
  node.width = w;
  node.height = h;
  node.constraints = { horizontal: 'MIN', vertical: 'MIN' };
  node.resize = (width, height) => {
    node.width = Math.min(width, node.maxWidth ?? Infinity);
    node.height = height;
  };
  return node;
}

test('an absolute rect inside an auto layout frame fills the frame with stretch constraints', async () => {
  const box = sized(rect({ layoutPositioning: 'ABSOLUTE' }), 10, 20, 50, 50);
  const layoutChild = sized(rect(), 0, 0, 30, 30);
  const parent = sized(row({}, [box, layoutChild]), 0, 0, 400, 300);
  page([parent]);
  const report = await runFit([parent], fit(), ctx());
  assert.deepEqual([box.x, box.y, box.width, box.height], [0, 0, 400, 300]);
  assert.deepEqual(box.constraints, { horizontal: 'STRETCH', vertical: 'STRETCH' });
  assert.deepEqual([layoutChild.width, layoutChild.height], [30, 30]);
  assert.equal(report.changed, 1);
});

test('width only leaves y, height and the vertical constraint alone', async () => {
  const box = sized(rect(), 10, 20, 50, 50);
  const parent = sized(frame({}, [box]), 0, 0, 400, 300);
  page([parent]);
  await runFit([parent], fit({ height: false, constraints: 'SCALE' }), ctx());
  assert.deepEqual([box.x, box.y, box.width, box.height], [0, 20, 400, 50]);
  assert.deepEqual(box.constraints, { horizontal: 'SCALE', vertical: 'MIN' });
});

test('keep leaves the constraints object untouched, no axis does nothing', async () => {
  const box = sized(rect(), 10, 20, 50, 50);
  const parent = sized(frame({}, [box]), 0, 0, 400, 300);
  page([parent]);
  await runFit([parent], fit({ constraints: 'keep' }), ctx());
  assert.deepEqual(box.constraints, { horizontal: 'MIN', vertical: 'MIN' });
  const report = await runFit([parent], fit({ width: false, height: false }), ctx());
  assert.equal(report.changed, 0);
});

test('rotated layers and lines on the wrong axis are skipped', async () => {
  const rotated = sized(rect({ rotation: 45 }), 0, 0, 10, 10);
  const line = sized(fake('LINE'), 0, 0, 10, 0);
  const parent = sized(frame({}, [rotated, line]), 0, 0, 400, 300);
  page([parent]);
  const report = await runFit([parent], fit({ width: false }), ctx());
  assert.equal(report.skipped.get('rotated')?.length, 1);
  assert.equal(report.skipped.get('line')?.length, 1);
  assert.equal(report.changed, 0);
  await runFit([parent], fit({ height: false }), ctx());
  assert.deepEqual([line.width, line.height], [400, 0]);
});

test('text switches to fixed sizing before both axes are set, and to height for width only', async () => {
  const label = sized(text(), 5, 5, 20, 10);
  const order: string[] = [];
  Object.defineProperty(label, 'textAutoResize', {
    set(value: string) {
      order.push(`resize:${value}`);
    },
    get: () => 'WIDTH_AND_HEIGHT',
  });
  label.resize = (w, h) => {
    order.push(`size:${w}x${h}`);
    label.width = w;
    label.height = h;
  };
  const parent = sized(frame({}, [label]), 0, 0, 100, 50);
  page([parent]);
  await runFit([parent], fit(), ctx());
  assert.deepEqual(order, ['resize:NONE', 'size:100x50']);
  await runFit([parent], fit({ height: false, constraints: 'keep' }), ctx());
  assert.equal(order[2], 'resize:HEIGHT');
});

test('a max width that clamps the result and an outside stroke are reported', async () => {
  const box = sized(rect({ maxWidth: 200, strokeAlign: 'OUTSIDE', strokes: [{}] }), 0, 0, 10, 10);
  const parent = sized(frame({}, [box]), 0, 0, 400, 300);
  page([parent]);
  const report = await runFit([parent], fit(), ctx());
  assert.equal(box.width, 200);
  assert.equal(report.skipped.get('clamped by min or max')?.length, 1);
  assert.equal(
    report.notes.some((n) => n.includes('stroke is outside')),
    true,
  );
});

test('a free child inside an instance that keeps its position is reported as not overridable', async () => {
  const pinned = sized(rect({ name: 'pinned' }), 10, 10, 20, 20);
  Object.defineProperty(pinned, 'x', { get: () => 10, set() {} });
  const instance = sized(fake('INSTANCE', { layoutMode: 'NONE' }, [pinned]), 0, 0, 100, 100);
  page([instance]);
  const report = await runFit([instance], fit(), ctx({ insideComponents: true }));
  assert.equal(report.skipped.get('not overridable')?.length, 1);
  assert.equal(report.changed, 0);
});
