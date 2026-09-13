import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canHug,
  depthOf,
  flowAxis,
  isAutoLayoutFrame,
  isFreeChild,
  isInsideInstance,
  isLayoutChild,
} from './classify.ts';
import { column, fake, frame, page, rect, row, text } from './fake.test-helper.ts';

test('auto layout frames are horizontal or vertical, never grid or none', () => {
  assert.equal(isAutoLayoutFrame(row()), true);
  assert.equal(isAutoLayoutFrame(column()), true);
  assert.equal(isAutoLayoutFrame(frame()), false);
  assert.equal(isAutoLayoutFrame(frame({ layoutMode: 'GRID' })), false);
  assert.equal(isAutoLayoutFrame(fake('INSTANCE', { layoutMode: 'VERTICAL' })), true);
  assert.equal(isAutoLayoutFrame(fake('SECTION', { layoutMode: 'VERTICAL' })), false);
  assert.equal(isAutoLayoutFrame(fake('SLOT', { layoutMode: 'VERTICAL' })), true);
});

test('children of a slot are layout children of the slot', () => {
  const inSlot = text();
  const slot = fake('SLOT', { layoutMode: 'VERTICAL' }, [inSlot]);
  const instance = fake('INSTANCE', { layoutMode: 'VERTICAL' }, [slot]);
  page([instance]);
  assert.equal(isLayoutChild(slot), true);
  assert.equal(isLayoutChild(inSlot), true);
  assert.equal(isFreeChild(inSlot), false);
});

test('layout child versus free child is decided by the parent and positioning', () => {
  const inRow = rect();
  const absolute = rect({ layoutPositioning: 'ABSOLUTE' });
  const inPlain = rect();
  page([row({}, [inRow, absolute]), frame({}, [inPlain])]);
  assert.equal(isLayoutChild(inRow), true);
  assert.equal(isFreeChild(inRow), false);
  assert.equal(isLayoutChild(absolute), false);
  assert.equal(isFreeChild(absolute), true);
  assert.equal(isLayoutChild(inPlain), false);
  assert.equal(isFreeChild(inPlain), true);
});

test('a root on the page is neither layout child nor free child', () => {
  const root = column();
  page([root]);
  assert.equal(isLayoutChild(root), false);
  assert.equal(isFreeChild(root), false);
});

test('only auto layout frames and text can hug', () => {
  assert.equal(canHug(column()), true);
  assert.equal(canHug(text()), true);
  assert.equal(canHug(rect()), false);
  assert.equal(canHug(frame()), false);
});

test('flow axis follows layoutMode', () => {
  assert.equal(flowAxis('HORIZONTAL'), 'x');
  assert.equal(flowAxis('VERTICAL'), 'y');
  assert.equal(flowAxis('GRID'), null);
  assert.equal(flowAxis('NONE'), null);
});

test('nodes inside an instance are detected, the instance itself is not', () => {
  const inner = text();
  const instance = fake('INSTANCE', { layoutMode: 'VERTICAL' }, [column({}, [inner])]);
  page([instance]);
  assert.equal(isInsideInstance(inner), true);
  assert.equal(isInsideInstance(instance), false);
  assert.equal(depthOf(inner), 3);
});
