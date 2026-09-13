import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ctx } from '../core/ctx.test-helper.ts';
import { column, fake, page, row, text } from '../core/fake.test-helper.ts';
import type { TextOptions } from '../params/options.ts';
import { alignFrameHorizontally, runText } from './text.ts';

function opts(overrides: Partial<TextOptions> = {}): TextOptions {
  return { scope: 'everything', align: 'keep', frame: false, resize: 'keep', ...overrides };
}

test('text plus frame centers the text and the parent on its horizontal axis', async () => {
  const inRow = text();
  const inColumn = text();
  const r = row({}, [inRow]);
  const c = column({}, [inColumn]);
  page([r, c]);
  const report = await runText([r, c], opts({ align: 'CENTER', frame: true }), ctx());
  assert.equal(inRow.textAlignHorizontal, 'CENTER');
  assert.equal(r.primaryAxisAlignItems, 'CENTER');
  assert.equal(r.counterAxisAlignItems, undefined);
  assert.equal(c.counterAxisAlignItems, 'CENTER');
  assert.equal(c.primaryAxisAlignItems, undefined);
  assert.equal(report.changed, 4);
});

test('text only leaves the frame alone and a parent without auto layout is reported', async () => {
  const label = text();
  const plain = fake('FRAME', { layoutMode: 'NONE' }, [label]);
  page([plain]);
  await runText([plain], opts({ align: 'RIGHT' }), ctx());
  assert.equal(label.textAlignHorizontal, 'RIGHT');
  assert.equal(plain.counterAxisAlignItems, undefined);
  const report = await runText([plain], opts({ align: 'LEFT', frame: true }), ctx());
  assert.equal(report.skipped.get('no auto layout')?.length, 1);
});

test('resize modes map to textAutoResize and fill also sets the layout sizing', async () => {
  const label = text({ textAutoResize: 'NONE' });
  const parent = column({ layoutSizingHorizontal: 'FIXED' }, [label]);
  page([parent]);
  await runText([parent], opts({ resize: 'fill' }), ctx());
  assert.equal(label.textAutoResize, 'HEIGHT');
  assert.equal(label.layoutSizingHorizontal, 'FILL');
  await runText([parent], opts({ resize: 'hug' }), ctx());
  assert.equal(label.textAutoResize, 'WIDTH_AND_HEIGHT');
  await runText([parent], opts({ resize: 'fixed' }), ctx());
  assert.equal(label.textAutoResize, 'NONE');
});

test('fill width under a hugging parent is refused by the guard', async () => {
  const label = text();
  const parent = column({ layoutSizingHorizontal: 'HUG' }, [label]);
  page([parent]);
  const report = await runText([parent], opts({ resize: 'fill' }), ctx());
  assert.equal(label.layoutSizingHorizontal, undefined);
  assert.equal(report.skipped.get('parent hugs')?.length, 1);
});

test('a missing font skips the node without stopping the run', async () => {
  const broken = text({ name: 'broken' });
  const fine = text({ name: 'fine' });
  const parent = column({}, [broken, fine]);
  page([parent]);
  const report = await runText(
    [parent],
    opts({ align: 'CENTER' }),
    ctx({}, (node) => Promise.resolve(node.name !== 'broken')),
  );
  assert.equal(broken.textAlignHorizontal, 'LEFT');
  assert.equal(fine.textAlignHorizontal, 'CENTER');
  assert.equal(report.skipped.get('missing font')?.length, 1);
});

test('alignFrameHorizontally reports whether it changed anything', () => {
  const r = row({ primaryAxisAlignItems: 'MAX' });
  assert.equal(alignFrameHorizontally(r, 'MAX'), 'unchanged');
  assert.equal(alignFrameHorizontally(r, 'MIN'), 'changed');
  assert.equal(r.primaryAxisAlignItems, 'MIN');
});

test('text inside an instance is written as an override', async () => {
  const label = text();
  const instance = fake('INSTANCE', { layoutMode: 'VERTICAL' }, [label]);
  page([instance]);
  const report = await runText(
    [instance],
    opts({ align: 'CENTER', frame: true, resize: 'hug' }),
    ctx({ insideComponents: true }),
  );
  assert.equal(label.textAlignHorizontal, 'CENTER');
  assert.equal(instance.counterAxisAlignItems, 'CENTER');
  assert.equal(report.changed, 2);
});
