import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ctx } from '../core/ctx.test-helper.ts';
import { column, fake, frame, page, row, text } from '../core/fake.test-helper.ts';
import type { AlignOptions } from '../params/options.ts';
import { axisAlignment, runAlign } from './align.ts';

function opts(overrides: Partial<AlignOptions> = {}): AlignOptions {
  return { scope: 'everything', h: 'MIN', v: 'MIN', spaceBetween: false, ...overrides };
}

test('the same position lands on swapped properties depending on layoutMode', () => {
  const topCenter = opts({ h: 'CENTER', v: 'MIN' });
  const bottomRight = opts({ h: 'MAX', v: 'MAX' });
  assert.deepEqual(axisAlignment('HORIZONTAL', topCenter), { primary: 'CENTER', counter: 'MIN' });
  assert.deepEqual(axisAlignment('VERTICAL', topCenter), { primary: 'MIN', counter: 'CENTER' });
  assert.deepEqual(axisAlignment('HORIZONTAL', bottomRight), { primary: 'MAX', counter: 'MAX' });
});

test('an axis on keep is not written', () => {
  assert.deepEqual(axisAlignment('VERTICAL', opts({ h: 'keep', v: 'MAX' })), {
    primary: 'MAX',
    counter: undefined,
  });
  assert.deepEqual(
    axisAlignment('HORIZONTAL', opts({ h: 'keep', v: 'keep', spaceBetween: true })),
    {
      primary: 'SPACE_BETWEEN',
      counter: undefined,
    },
  );
});

test('space between replaces the primary axis and keeps the counter axis edge', () => {
  assert.deepEqual(axisAlignment('VERTICAL', opts({ h: 'CENTER', v: 'MAX', spaceBetween: true })), {
    primary: 'SPACE_BETWEEN',
    counter: 'CENTER',
  });
  assert.deepEqual(
    axisAlignment('HORIZONTAL', opts({ h: 'CENTER', v: 'MAX', spaceBetween: true })),
    {
      primary: 'SPACE_BETWEEN',
      counter: 'MAX',
    },
  );
});

test('runAlign writes every auto layout frame in the tree and skips the rest', async () => {
  const inner = row({});
  const grid = frame({ layoutMode: 'GRID' });
  const plain = frame({});
  const label = text();
  const instanceContent = column({});
  const instance = fake('INSTANCE', { layoutMode: 'HORIZONTAL' }, [instanceContent]);
  const root = column({}, [inner, grid, plain, label, instance]);
  page([root]);
  const report = await runAlign(
    [root],
    opts({ h: 'CENTER', v: 'MAX' }),
    ctx({ insideComponents: true }),
  );
  assert.deepEqual([root.primaryAxisAlignItems, root.counterAxisAlignItems], ['MAX', 'CENTER']);
  assert.deepEqual([inner.primaryAxisAlignItems, inner.counterAxisAlignItems], ['CENTER', 'MAX']);
  assert.deepEqual(
    [instance.primaryAxisAlignItems, instance.counterAxisAlignItems],
    ['CENTER', 'MAX'],
  );
  assert.deepEqual(
    [instanceContent.primaryAxisAlignItems, instanceContent.counterAxisAlignItems],
    ['MAX', 'CENTER'],
  );
  assert.equal(report.changed, 4);
  assert.equal(report.skipped.get('grid layout')?.length, 1);
  assert.equal(report.skipped.get('no auto layout')?.length, 1);
});

test('frames that already match count as unchanged', async () => {
  const root = column({ primaryAxisAlignItems: 'MIN', counterAxisAlignItems: 'MIN' });
  page([root]);
  const report = await runAlign([root], opts(), ctx());
  assert.equal(report.changed, 0);
  assert.equal(report.unchanged, 1);
});

test('a write that Figma silently drops inside an instance is reported as not overridable', async () => {
  const sealed = column({ name: 'sealed' });
  Object.defineProperty(sealed, 'primaryAxisAlignItems', { get: () => 'MIN', set() {} });
  const instance = fake('INSTANCE', { layoutMode: 'VERTICAL' }, [sealed]);
  page([instance]);
  const report = await runAlign(
    [instance],
    opts({ h: 'CENTER', v: 'MAX' }),
    ctx({ insideComponents: true }),
  );
  assert.equal(report.skipped.get('not overridable')?.length, 1);
  assert.equal(report.changed, 1);
});

test('an instance root is not aligned, its slot content is', async () => {
  const inner = column({ name: 'inner' });
  const slot = fake('SLOT', { name: 'Slot', layoutMode: 'VERTICAL' }, [inner]);
  const own = column({ name: 'own' });
  const instance = fake('INSTANCE', { name: 'Card', layoutMode: 'VERTICAL' }, [own, slot]);
  const root = column({}, [instance]);
  page([root]);
  const report = await runAlign([root], opts({ h: 'CENTER', v: 'CENTER' }), ctx());
  assert.equal(instance.primaryAxisAlignItems, undefined);
  assert.equal(own.primaryAxisAlignItems, undefined);
  assert.equal(slot.primaryAxisAlignItems, 'CENTER');
  assert.equal(inner.primaryAxisAlignItems, 'CENTER');
  assert.equal(report.changed, 3);
  assert.deepEqual(
    report.instances.map((l) => l.name),
    ['Card'],
  );
});
