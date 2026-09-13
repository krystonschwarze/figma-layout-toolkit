import assert from 'node:assert/strict';
import { test } from 'node:test';
import { column, fake, page, rect, row, text } from './fake.test-helper.ts';
import { bottomUp, collectScope, matchesFrameFilter, topDown } from './scope.ts';

function tree() {
  const leaf = text({ name: 'leaf' });
  const inner = row({ name: 'inner' }, [leaf]);
  const root = column({ name: 'root' }, [inner, rect({ name: 'sibling' })]);
  page([root]);
  return { root, inner, leaf };
}

test('collectScope walks the whole tree with depths and the root flag', () => {
  const { root } = tree();
  const scope = collectScope([root]);
  assert.deepEqual(
    scope.map((s) => [s.node.name, s.depth, s.isRoot]),
    [
      ['root', 0, true],
      ['inner', 1, false],
      ['leaf', 2, false],
      ['sibling', 1, false],
    ],
  );
});

test('selection only and children only split roots from descendants', () => {
  const { root } = tree();
  assert.deepEqual(
    collectScope([root], 'selection-only').map((s) => s.node.name),
    ['root'],
  );
  assert.deepEqual(
    collectScope([root], 'children-only').map((s) => s.node.name),
    ['inner', 'leaf', 'sibling'],
  );
});

test('a node reached through two roots is collected once', () => {
  const { root, inner } = tree();
  const names = collectScope([root, inner]).map((s) => s.node.name);
  assert.deepEqual(names, ['root', 'inner', 'leaf', 'sibling']);
});

test('bottomUp puts the deepest nodes first, topDown the roots', () => {
  const { root } = tree();
  const scope = collectScope([root]);
  assert.deepEqual(
    bottomUp(scope).map((s) => s.depth),
    [2, 1, 1, 0],
  );
  assert.deepEqual(
    topDown(scope).map((s) => s.depth),
    [0, 1, 1, 2],
  );
});

test('frame filters only accept frames of the matching direction', () => {
  assert.equal(matchesFrameFilter(row(), 'horizontal'), true);
  assert.equal(matchesFrameFilter(row(), 'vertical'), false);
  assert.equal(matchesFrameFilter(text(), 'vertical'), false);
  assert.equal(matchesFrameFilter(text(), 'all'), true);
});

test('an instance is a boundary that is only entered through its slots', () => {
  const label = text({ name: 'label' });
  const button = fake('INSTANCE', { name: 'button', layoutMode: 'HORIZONTAL' }, [label]);
  const own = column({ name: 'own' });
  const slot = fake('SLOT', { name: 'slot', layoutMode: 'VERTICAL' }, [button]);
  const card = fake('INSTANCE', { name: 'card', layoutMode: 'VERTICAL' }, [own, slot]);
  const root = column({ name: 'root' }, [card]);
  page([root]);
  assert.deepEqual(
    collectScope([root]).map((s) => [s.node.name, s.boundary]),
    [
      ['root', false],
      ['card', true],
      ['slot', false],
      ['button', true],
    ],
  );
  assert.deepEqual(
    collectScope([root], 'everything', true).map((s) => s.node.name),
    ['root', 'card', 'own', 'slot', 'button', 'label'],
  );
});
