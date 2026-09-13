import type { TreeNode } from './types.ts';

export interface FakeNode extends TreeNode {
  parent: FakeNode | null;
  children: FakeNode[];
  id: string;
  name: string;
  type: string;
}

let counter = 0;

type Props = Partial<Omit<FakeNode, 'parent' | 'children' | 'id' | 'type'>> & { type?: string };

export function fake(type: string, props: Props = {}, children: FakeNode[] = []): FakeNode {
  counter += 1;
  const node: FakeNode = {
    id: String(counter),
    name: props.name ?? `${type.toLowerCase()} ${counter}`,
    type,
    parent: null,
    children,
    visible: true,
    locked: false,
    ...props,
  };
  for (const child of children) child.parent = node;
  return node;
}

export function frame(props: Props = {}, children: FakeNode[] = []): FakeNode {
  return fake('FRAME', { layoutMode: 'NONE', ...props }, children);
}

export function column(props: Props = {}, children: FakeNode[] = []): FakeNode {
  return frame({ layoutMode: 'VERTICAL', ...props }, children);
}

export function row(props: Props = {}, children: FakeNode[] = []): FakeNode {
  return frame({ layoutMode: 'HORIZONTAL', ...props }, children);
}

export function text(props: Props = {}): FakeNode {
  return fake('TEXT', {
    textAlignHorizontal: 'LEFT',
    textAutoResize: 'WIDTH_AND_HEIGHT',
    ...props,
  });
}

export function rect(props: Props = {}): FakeNode {
  return fake('RECTANGLE', props);
}

export function page(children: FakeNode[]): FakeNode {
  return fake('PAGE', {}, children);
}
