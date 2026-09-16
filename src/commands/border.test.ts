import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ctx } from '../core/ctx.test-helper.ts';
import { column, fake, frame, page, rect, row } from '../core/fake.test-helper.ts';
import type { BorderOptions } from '../params/options.ts';
import { hasVisibleBorder, runBorder } from './border.ts';

function opts(overrides: Partial<BorderOptions> = {}): BorderOptions {
  return {
    scope: 'everything',
    included: true,
    skipComponents: true,
    exemptRoots: true,
    ...overrides,
  };
}

const solid = [{ visible: true }];

test('every frame that lays out gets the property, grid included', async () => {
  const grid = frame({ name: 'grid', layoutMode: 'GRID' });
  const inner = row({ name: 'inner' });
  const plain = frame({ name: 'plain' }, [rect()]);
  const root = column({ name: 'root' }, [grid, inner, plain]);
  page([root]);

  const report = await runBorder([root], opts(), ctx());

  assert.equal(root.strokesIncludedInLayout, true);
  assert.equal(grid.strokesIncludedInLayout, true);
  assert.equal(inner.strokesIncludedInLayout, true);
  assert.equal(report.changed, 3);
  /* Figma throws on a frame without layout, so it never reaches the write. */
  assert.equal(plain.strokesIncludedInLayout, undefined);
  assert.equal(report.skipped.get('no layout')?.length, 1);
});

test('excluded writes false', async () => {
  const root = column({ strokesIncludedInLayout: true });
  page([root]);
  const report = await runBorder([root], opts({ included: false }), ctx());
  assert.equal(root.strokesIncludedInLayout, false);
  assert.equal(report.changed, 1);
});

test('a frame that already matches counts as unchanged', async () => {
  const root = column({ strokesIncludedInLayout: true });
  page([root]);
  const report = await runBorder([root], opts(), ctx());
  assert.equal(report.changed, 0);
  assert.equal(report.unchanged, 1);
});

test('only a frame with a border that actually draws is reported as resized', () => {
  assert.equal(hasVisibleBorder(column({ strokes: solid, strokeWeight: 1 })), true);
  assert.equal(hasVisibleBorder(column({ strokes: solid, strokeWeight: 0 })), false);
  assert.equal(hasVisibleBorder(column({ strokes: [{ visible: false }], strokeWeight: 2 })), false);
  assert.equal(hasVisibleBorder(column({ strokes: [], strokeWeight: 2 })), false);
  assert.equal(hasVisibleBorder(column({})), false);
});

test('bordered lists the frames whose size moves, changed counts all of them', async () => {
  const bordered = column({ name: 'card', strokes: solid, strokeWeight: 1 });
  const bare = column({ name: 'bare' });
  const root = column({ name: 'root' }, [bordered, bare]);
  page([root]);

  const report = await runBorder([root], opts(), ctx());

  assert.equal(report.changed, 3);
  assert.deepEqual(
    report.bordered.map((l) => l.name),
    ['card'],
  );
});

test('skip components leaves components, sets and instances alone with everything inside', async () => {
  const variant = column({ name: 'variant' });
  const set = fake('COMPONENT_SET', { name: 'Button', layoutMode: 'HORIZONTAL' }, [variant]);
  const master = fake('COMPONENT', { name: 'Icon', layoutMode: 'VERTICAL' });
  const slotContent = column({ name: 'slot content' });
  const slot = fake('SLOT', { name: 'Slot', layoutMode: 'VERTICAL' }, [slotContent]);
  const instance = fake('INSTANCE', { name: 'Card', layoutMode: 'VERTICAL' }, [slot]);
  const mine = column({ name: 'mine' });
  const root = column({ name: 'root' }, [set, master, instance, mine]);
  page([root]);

  const report = await runBorder([root], opts(), ctx());

  assert.equal(root.strokesIncludedInLayout, true);
  assert.equal(mine.strokesIncludedInLayout, true);
  for (const node of [set, master, instance, variant, slot, slotContent]) {
    assert.equal(node.strokesIncludedInLayout, undefined, node.name);
  }
  assert.equal(report.changed, 2);
  assert.deepEqual(
    report.skipped.get('component or instance')?.map((l) => l.name),
    ['Button', 'Icon', 'Card'],
  );
  assert.deepEqual(report.instances, []);
});

test('without the skip an instance is written and its slot content with it', async () => {
  const slotContent = column({ name: 'slot content' });
  const slot = fake('SLOT', { name: 'Slot', layoutMode: 'VERTICAL' }, [slotContent]);
  const own = column({ name: 'own' });
  const instance = fake('INSTANCE', { name: 'Card', layoutMode: 'VERTICAL' }, [own, slot]);
  page([instance]);

  const report = await runBorder([instance], opts({ skipComponents: false }), ctx());

  assert.equal(instance.strokesIncludedInLayout, true);
  assert.equal(slot.strokesIncludedInLayout, true);
  assert.equal(slotContent.strokesIncludedInLayout, true);
  /* The component's own layers stay with the component unless the policy enters them. */
  assert.equal(own.strokesIncludedInLayout, undefined);
  assert.equal(report.changed, 3);
  assert.deepEqual(
    report.instances.map((l) => l.name),
    ['Card'],
  );
});

test('locked and hidden frames are skipped while the policy asks for it', async () => {
  const locked = column({ name: 'locked', locked: true });
  const hidden = column({ name: 'hidden', visible: false });
  const root = column({ name: 'root' }, [locked, hidden]);
  page([root]);

  const report = await runBorder([root], opts(), ctx());

  assert.equal(locked.strokesIncludedInLayout, undefined);
  assert.equal(hidden.strokesIncludedInLayout, undefined);
  assert.equal(report.skipped.get('locked')?.length, 1);
  assert.equal(report.skipped.get('hidden')?.length, 1);
  assert.equal(report.changed, 1);
});

test('a write Figma silently drops inside an instance is reported as not overridable', async () => {
  const sealed = column({ name: 'sealed' });
  Object.defineProperty(sealed, 'strokesIncludedInLayout', { get: () => false, set() {} });
  const instance = fake('INSTANCE', { name: 'Card', layoutMode: 'VERTICAL' }, [sealed]);
  page([instance]);

  const report = await runBorder(
    [instance],
    opts({ skipComponents: false }),
    ctx({ insideComponents: true }),
  );

  assert.equal(report.skipped.get('not overridable')?.length, 1);
  assert.equal(report.changed, 1);
});

test('the scope filter still narrows what is reached', async () => {
  const inner = column({ name: 'inner' });
  const root = column({ name: 'root' }, [inner]);
  page([root]);

  const report = await runBorder([root], opts({ scope: 'selection-only' }), ctx());

  assert.equal(root.strokesIncludedInLayout, true);
  assert.equal(inner.strokesIncludedInLayout, undefined);
  assert.equal(report.changed, 1);
});

test('a main component chosen by hand is written and entered, its nested instances are not', async () => {
  const insideInstance = column({ name: 'inside instance' });
  const nested = fake('INSTANCE', { name: 'Icon', layoutMode: 'VERTICAL' }, [insideInstance]);
  const ownFrame = column({ name: 'own frame' }, [nested]);
  const master = fake('COMPONENT', { name: 'Card', layoutMode: 'VERTICAL' }, [ownFrame]);
  page([master]);

  const report = await runBorder([master], opts(), ctx());

  assert.equal(master.strokesIncludedInLayout, true);
  assert.equal(ownFrame.strokesIncludedInLayout, true);
  assert.equal(nested.strokesIncludedInLayout, undefined);
  assert.equal(insideInstance.strokesIncludedInLayout, undefined);
  assert.equal(report.changed, 2);
  assert.deepEqual(
    report.skipped.get('component or instance')?.map((l) => l.name),
    ['Icon'],
  );
});

test('choosing a component set reaches its variants, a set found in the tree does not', async () => {
  const first = column({ name: 'Breakpoint=Desktop' });
  const second = column({ name: 'Breakpoint=Mobile' });
  const set = fake('COMPONENT_SET', { name: 'Card', layoutMode: 'HORIZONTAL' }, [first, second]);
  page([set]);

  const chosen = await runBorder([set], opts(), ctx());
  assert.equal(first.strokesIncludedInLayout, true);
  assert.equal(second.strokesIncludedInLayout, true);
  assert.equal(chosen.changed, 2);

  const other = column({ name: 'variant' });
  const buried = fake('COMPONENT_SET', { name: 'Buried' }, [other]);
  const root = column({ name: 'root' }, [buried]);
  page([root]);

  const found = await runBorder([root], opts(), ctx());
  assert.equal(other.strokesIncludedInLayout, undefined);
  assert.deepEqual(
    found.skipped.get('component or instance')?.map((l) => l.name),
    ['Buried'],
  );
});

test('a page sweep has nothing chosen by hand, so a top level component stays untouched', async () => {
  const inner = column({ name: 'inner' });
  const master = fake('COMPONENT', { name: 'Card', layoutMode: 'VERTICAL' }, [inner]);
  const mine = column({ name: 'mine' });
  page([master, mine]);

  const report = await runBorder([master, mine], opts({ exemptRoots: false }), ctx());

  assert.equal(master.strokesIncludedInLayout, undefined);
  assert.equal(inner.strokesIncludedInLayout, undefined);
  assert.equal(mine.strokesIncludedInLayout, true);
  assert.equal(report.changed, 1);
  assert.deepEqual(
    report.skipped.get('component or instance')?.map((l) => l.name),
    ['Card'],
  );
});

test('an instance chosen by hand is written once, its slot content follows, no double report', async () => {
  const slotContent = column({ name: 'slot content' });
  const slot = fake('SLOT', { name: 'Slot', layoutMode: 'VERTICAL' }, [slotContent]);
  const own = column({ name: 'own' });
  const instance = fake('INSTANCE', { name: 'Card', layoutMode: 'VERTICAL' }, [own, slot]);
  page([instance]);

  const report = await runBorder([instance], opts(), ctx());

  assert.equal(instance.strokesIncludedInLayout, true);
  assert.equal(slotContent.strokesIncludedInLayout, true);
  assert.equal(own.strokesIncludedInLayout, undefined);
  assert.equal(report.skipped.get('component or instance'), undefined);
  assert.deepEqual(
    report.instances.map((l) => l.name),
    ['Card'],
  );
});
