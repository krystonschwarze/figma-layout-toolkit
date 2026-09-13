export type Axis = 'x' | 'y';
export type Sizing = 'FIXED' | 'HUG' | 'FILL';
export type LayoutMode = 'NONE' | 'HORIZONTAL' | 'VERTICAL' | 'GRID';
export type ConstraintValue = 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
export type PrimaryAlign = 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
export type CounterAlign = 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
export type TextAlign = 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
export type TextResize = 'NONE' | 'WIDTH_AND_HEIGHT' | 'HEIGHT' | 'TRUNCATE';

/*
 * The structural subset of Figma's SceneNode that the core works on. Real nodes satisfy it, and so
 * do the fakes in the tests, which is what keeps the classification logic runnable outside Figma.
 */
export interface TreeNode {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly parent: TreeNode | null;
  readonly children?: readonly TreeNode[];
  visible: boolean;
  locked: boolean;
  layoutMode?: LayoutMode;
  layoutPositioning?: 'AUTO' | 'ABSOLUTE';
  layoutSizingHorizontal?: Sizing;
  layoutSizingVertical?: Sizing;
  primaryAxisAlignItems?: PrimaryAlign;
  counterAxisAlignItems?: CounterAlign;
  textAlignHorizontal?: TextAlign;
  textAutoResize?: TextResize;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  constraints?: { readonly horizontal: ConstraintValue; readonly vertical: ConstraintValue };
  strokeAlign?: 'CENTER' | 'INSIDE' | 'OUTSIDE';
  strokes?: readonly { readonly visible?: boolean }[];
  minWidth?: number | null;
  maxWidth?: number | null;
  minHeight?: number | null;
  maxHeight?: number | null;
  resize?: (width: number, height: number) => void;
}
