import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ctx } from '../core/ctx.test-helper.ts';
import { column, fake, frame, page, rect, row, text } from '../core/fake.test-helper.ts';
import type { FakeNode } from '../core/fake.test-helper.ts';
import type { HugFillOptions, SizingChoice } from '../params/options.ts';
import { autoPlan, runHugFill } from './hugFill.ts';

const sizing = (node: FakeNode) => [node.layoutSizingHorizontal, node.layoutSizingVertical];

const AUTO: HugFillOptions = { scope: 'everything', frames: 'all', mode: { kind: 'auto' } };

function custom(
  x: SizingChoice,
  y: SizingChoice,
  rest: Partial<Omit<HugFillOptions, 'mode'>> = {},
): HugFillOptions {
  return { scope: 'everything', frames: 'all', ...rest, mode: { kind: 'custom', x, y } };
}

function deepTree() {
  const leaf = text({ name: 'leaf' });
  const l4 = row({ name: 'l4' }, [leaf]);
  const l3 = column({ name: 'l3' }, [l4]);
  const l2 = row({ name: 'l2' }, [l3]);
  const l1 = column({ name: 'l1' }, [l2]);
  const root = row(
    { name: 'root', layoutSizingHorizontal: 'FIXED', layoutSizingVertical: 'FIXED' },
    [l1],
  );
  page([root]);
  return { root, l1, l2, l3, l4, leaf };
}

test('auto plans hug along the parent flow and fill across it', () => {
  const child = column();
  row({}, [child]);
  assert.deepEqual(autoPlan(child), { x: 'HUG', y: 'FILL' });
  const inColumn = row();
  column({}, [inColumn]);
  assert.deepEqual(autoPlan(inColumn), { y: 'HUG', x: 'FILL' });
});

test('auto never fills text vertically', () => {
  const inRow = text();
  row({}, [inRow]);
  assert.deepEqual(autoPlan(inRow), { x: 'HUG', y: 'HUG' });
  const inColumn = text();
  column({}, [inColumn]);
  assert.deepEqual(autoPlan(inColumn), { y: 'HUG', x: 'FILL' });
});

test('auto has nothing to say for roots on the page or plain rectangles', () => {
  const root = column();
  page([root]);
  assert.equal(autoPlan(root), null);
  const shape = rect();
  row({}, [shape]);
  assert.equal(autoPlan(shape), null);
});

test('auto sets a five level tree with alternating directions in one go', async () => {
  const { root, l1, l2, l3, l4, leaf } = deepTree();
  const report = await runHugFill([root], AUTO, ctx());
  assert.deepEqual(sizing(l1), ['HUG', 'FILL']);
  assert.deepEqual(sizing(l2), ['HUG', 'HUG']);
  assert.deepEqual(sizing(l3), ['HUG', 'HUG']);
  assert.deepEqual(sizing(l4), ['HUG', 'HUG']);
  assert.deepEqual(sizing(leaf), ['HUG', 'HUG']);
  assert.equal(report.changed, 5);
  assert.equal(report.unchanged, 1);
  assert.equal(report.notes.filter((n) => n.includes('falling back')).length, 3);
});

test('auto falls back to hug where the parent will hug the same axis', async () => {
  const inner = text({ name: 'inner' });
  const middle = column({ name: 'middle' }, [inner]);
  const root = column({ name: 'root', layoutSizingHorizontal: 'FIXED' }, [middle]);
  page([root]);
  await runHugFill([root], custom('FILL', 'keep'), ctx());
  assert.equal(middle.layoutSizingHorizontal, 'FILL');
  assert.equal(inner.layoutSizingHorizontal, 'FILL');

  const hugged = text({ name: 'hugged' });
  const hugParent = column({ name: 'parent' }, [hugged]);
  const outer = row({ name: 'outer' }, [hugParent]);
  page([outer]);
  const report = await runHugFill([outer], AUTO, ctx());
  assert.deepEqual(sizing(hugParent), ['HUG', 'FILL']);
  assert.deepEqual(sizing(hugged), ['HUG', 'HUG']);
  assert.equal(report.skipped.get('parent hugs'), undefined);
  assert.equal(
    report.notes.some((n) => n.includes('falling back')),
    true,
  );
});

test('custom fill under a hugging parent out of scope is skipped, not rewritten', async () => {
  const child = text();
  const parent = column({ layoutSizingHorizontal: 'HUG' }, [child]);
  page([parent]);
  const report = await runHugFill([child], custom('FILL', 'keep'), ctx());
  assert.equal(child.layoutSizingHorizontal, undefined);
  assert.equal(report.skipped.get('parent hugs')?.length, 1);
});

test('Hug X leaves every vertical sizing untouched, including fill', async () => {
  const child = column({ layoutSizingHorizontal: 'FIXED', layoutSizingVertical: 'FILL' });
  const root = row({}, [child]);
  page([root]);
  await runHugFill([root], custom('HUG', 'keep'), ctx());
  assert.deepEqual(sizing(child), ['HUG', 'FILL']);
});

test('the vertical frame filter touches no horizontal frame and no text', async () => {
  const leaf = text();
  const horizontal = row({}, [leaf]);
  const vertical = column({}, [horizontal]);
  const root = column({}, [vertical]);
  page([root]);
  await runHugFill([root], custom('keep', 'HUG', { frames: 'vertical' }), ctx());
  assert.equal(vertical.layoutSizingVertical, 'HUG');
  assert.equal(horizontal.layoutSizingVertical, undefined);
  assert.equal(leaf.layoutSizingVertical, undefined);
});

test('children only leaves the roots alone, selection only touches nothing else', async () => {
  const child = column();
  const root = column({}, [child]);
  page([root]);
  await runHugFill([root], custom('keep', 'HUG', { scope: 'children-only' }), ctx());
  assert.equal(root.layoutSizingVertical, undefined);
  assert.equal(child.layoutSizingVertical, 'HUG');
  await runHugFill([root], custom('FIXED', 'keep', { scope: 'selection-only' }), ctx());
  assert.equal(root.layoutSizingHorizontal, 'FIXED');
  assert.equal(child.layoutSizingHorizontal, undefined);
});

test('custom fill reaches plain layout children, hug does not', async () => {
  const icon = rect();
  const root = row({}, [icon]);
  page([root]);
  await runHugFill([root], custom('keep', 'FILL'), ctx());
  assert.equal(icon.layoutSizingVertical, 'FILL');
  const report = await runHugFill([root], custom('HUG', 'keep'), ctx());
  assert.equal(icon.layoutSizingHorizontal, undefined);
  assert.equal(report.skipped.get('cannot hug')?.length, 1);
});

test('instance content is written as an override, locked and hidden layers are skipped', async () => {
  const insideInstance = text({ name: 'inside' });
  const instance = fake('INSTANCE', { layoutMode: 'VERTICAL' }, [insideInstance]);
  const plain = frame({ name: 'plain' });
  const locked = column({ locked: true });
  const hidden = column({ visible: false });
  const root = column({}, [instance, plain, locked, hidden]);
  page([root]);
  const report = await runHugFill([root], custom('keep', 'HUG'), ctx({ insideComponents: true }));
  assert.equal(instance.layoutSizingVertical, 'HUG');
  assert.equal(insideInstance.layoutSizingVertical, 'HUG');
  assert.equal(report.skipped.get('locked')?.length, 1);
  assert.equal(report.skipped.get('hidden')?.length, 1);
  assert.equal(plain.layoutSizingVertical, undefined);
});

test('the policy can include locked layers and enter component layers', async () => {
  const insideInstance = text({ name: 'inside' });
  const instance = fake('INSTANCE', { layoutMode: 'VERTICAL' }, [insideInstance]);
  const locked = column({ locked: true });
  const root = column({}, [instance, locked]);
  page([root]);
  const report = await runHugFill(
    [root],
    custom('keep', 'HUG'),
    ctx({ skipLocked: false, insideComponents: true }),
  );
  assert.equal(locked.layoutSizingVertical, 'HUG');
  assert.equal(insideInstance.layoutSizingVertical, 'HUG');
  assert.equal(report.instances.length, 0);
});

test('an instance is one layer: its root is sized, its own layers stay, its slot content runs', async () => {
  const label = text({ name: 'label' });
  const button = fake('INSTANCE', { name: 'Button', layoutMode: 'HORIZONTAL' }, [label]);
  const headerText = text({ name: 'header text' });
  const header = row({ name: 'header' }, [headerText]);
  const slotText = text({ name: 'slot text' });
  const slotFrame = column({ name: 'slot frame' }, [slotText]);
  const slot = fake('SLOT', { name: 'Slot', layoutMode: 'VERTICAL' }, [slotFrame, button]);
  const card = fake('INSTANCE', { name: 'Card', layoutMode: 'VERTICAL' }, [header, slot]);
  const root = column({ name: 'root' }, [card]);
  page([column({}, [root])]);
  const report = await runHugFill([root], custom('FILL', 'keep'), ctx());
  assert.equal(card.layoutSizingHorizontal, 'FILL');
  assert.equal(header.layoutSizingHorizontal, undefined);
  assert.equal(headerText.layoutSizingHorizontal, undefined);
  assert.equal(slot.layoutSizingHorizontal, 'FILL');
  assert.equal(slotFrame.layoutSizingHorizontal, 'FILL');
  assert.equal(slotText.layoutSizingHorizontal, 'FILL');
  assert.equal(button.layoutSizingHorizontal, 'FILL');
  assert.equal(label.layoutSizingHorizontal, undefined);
  assert.deepEqual(
    report.instances.map((l) => l.name),
    ['Card', 'Button'],
  );
  assert.equal(report.skipped.size, 0);
});

test('children scope on an instance still names it as the layer that was kept', async () => {
  const own = column({ name: 'own' });
  const inner = column({ name: 'inner' });
  const slot = fake('SLOT', { name: 'Slot', layoutMode: 'VERTICAL' }, [inner]);
  const card = fake('INSTANCE', { name: 'Card', layoutMode: 'VERTICAL' }, [own, slot]);
  page([column({}, [card])]);
  const report = await runHugFill(
    [card],
    custom('FILL', 'keep', { scope: 'children-only' }),
    ctx(),
  );
  assert.equal(card.layoutSizingHorizontal, undefined);
  assert.equal(own.layoutSizingHorizontal, undefined);
  assert.equal(inner.layoutSizingHorizontal, 'FILL');
  assert.deepEqual(
    report.instances.map((l) => l.name),
    ['Card'],
  );
});

test('a selected layer inside an instance is always processed', async () => {
  const label = text({ name: 'label' });
  const button = fake('INSTANCE', { layoutMode: 'HORIZONTAL' }, [label]);
  page([column({}, [button])]);
  const report = await runHugFill([label], custom('FILL', 'keep'), ctx());
  assert.equal(label.layoutSizingHorizontal, 'FILL');
  assert.equal(report.changed, 1);
});

test('a sizing write that does not stick inside an instance is counted as not overridable', async () => {
  const sealed = text({ name: 'sealed' });
  Object.defineProperty(sealed, 'layoutSizingVertical', { get: () => undefined, set() {} });
  const instance = fake('INSTANCE', { layoutMode: 'VERTICAL' }, [sealed]);
  page([instance]);
  const report = await runHugFill(
    [instance],
    custom('keep', 'HUG', { scope: 'children-only' }),
    ctx({ insideComponents: true }),
  );
  assert.equal(report.skipped.get('not overridable')?.length, 1);
  assert.equal(report.changed, 0);
});

test('a write that throws is counted and does not stop the run', async () => {
  const bad = column({ name: 'bad' });
  Object.defineProperty(bad, 'layoutSizingVertical', {
    set() {
      throw new Error('nope');
    },
    get() {
      return undefined;
    },
  });
  const good = column({ name: 'good' });
  const root = column({}, [bad, good]);
  page([root]);
  const report = await runHugFill([root], custom('keep', 'HUG', { scope: 'children-only' }), ctx());
  assert.equal(good.layoutSizingVertical, 'HUG');
  assert.equal(report.skipped.get('write failed')?.length, 1);
  assert.equal(report.changed, 1);
});

test('a text layer whose font is missing is skipped before any sizing write', async () => {
  const label = text({ name: 'broken' });
  const root = column({}, [label]);
  page([root]);
  const report = await runHugFill(
    [root],
    AUTO,
    ctx({}, (node) => Promise.resolve(node.name !== 'broken')),
  );
  assert.equal(label.layoutSizingHorizontal, undefined);
  assert.equal(report.skipped.get('missing font')?.length, 1);
});

test('a slot inside an instance and the layers in it are sized like any frame', async () => {
  const label = text({ name: 'in slot' });
  const slot = fake('SLOT', { name: 'slot', layoutMode: 'VERTICAL' }, [label]);
  const instance = fake('INSTANCE', { layoutMode: 'VERTICAL' }, [slot]);
  page([instance]);
  const report = await runHugFill([instance], custom('FILL', 'keep'), ctx());
  assert.equal(slot.layoutSizingHorizontal, 'FILL');
  assert.equal(label.layoutSizingHorizontal, 'FILL');
  assert.deepEqual([...report.skipped.keys()], ['not a layout child']);
});
