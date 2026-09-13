# Layout Toolkit

Figma plugin with a palette of one click actions for whole layer trees: hug, fill and fixed sizing
per axis, text alignment and resizing, alignment of auto layout frames, and fit to parent. Every
button does one thing to everything nested under the selection. What used to be dozens of clicks in
the properties panel is one.

## What it does

Select one or more layers and open the plugin. The window is a palette: every button does one
thing to the selected layers and everything nested inside them, right away, as its own undo step.
There is nothing to configure and no Apply. The status line at the bottom says what the last click
did, and the window stays open so a tree can be worked on click by click.

**Scope** sits under the header. `Nested` is the default and means the selection and all its
descendants. `Children` leaves the selected layers themselves alone and works on what is inside.
`Self` touches only the selected layers, which turns the palette into a bulk editor for a multi
selection.

### Sizing

Six buttons, one axis and one value each: hug, fill and fixed, for width and for height. A click
sets exactly that axis on every auto layout frame and text layer in scope and leaves the other axis
alone, including a fill that is already there. Fill also reaches plain layout children such as icons.
Frames run bottom up so parents measure children that are already final.

The seventh button is **Auto**: hug along the axis the parent stacks on, fill across it. A frame in
a column becomes hug height and fill width, a frame in a row the other way round. Text never fills
vertically. Figma refuses fill on an axis where the parent hugs, so where the rule would produce
that, the child hugs as well and the console says so. The same guard skips and counts a fill from
the explicit buttons.

### Text

Left, center, right and justify set the alignment of every text layer in scope. The **+frame**
checkbox next to the row, on by default, also aligns the parent auto layout frame the same way, on
whichever of its axis properties is the horizontal one. That is the point of the coupling: a hugging
text layer is exactly as wide as its text, so its own alignment shows nothing until the frame moves
it. Justify ignores the checkbox. The three resize buttons set hug, fill width with hugged height,
or fixed. Fonts are loaded before any write, a text layer whose font is missing is skipped and
counted.

### Align frames

The nine dot picker aligns the children of every auto layout frame in scope, one click per dot.
The dots describe horizontal and vertical edges, the frame properties are named after the primary
and counter axis, so the mapping flips with the layout direction and is computed per frame.
**Space between** sets the primary axis and leaves the counter axis as it is.

### Fit to parent

Width, height or both stretch free layers to their parent: children of frames without auto layout
and absolutely positioned children of auto layout frames. Layout children are not touched, the
sizing buttons are what drives them. The constraints written on the fitted axes come from the
settings, stretch by default.

Rotated layers are skipped. A line only fits horizontally. A text layer switches to fixed sizing
first so the size sticks. If a min or max size keeps a layer short of the target the status line
counts it, and a stroke that sits outside or centered is noted in the console because the layer will
visibly reach past the frame.

## The status line

After every click the line above the bottom edge names the action and says how many layers changed
and how many were skipped. Click it to see the skipped layers grouped by reason, each name is a
button that selects the layer on the canvas. More detail, including the fall backs of Auto and stroke
notes, goes to the console.

## Instances

An instance counts as one layer. Its own sizing is set like any other layout child, because how a
Card sits in your column is your layout, not the component's. What the component brings along is
never entered, so a Button keeps its label and a Badge keeps its padding. Slots are the exception:
what you placed inside a slot is your content and runs like your own frames, and an instance in
there is again one layer. Align frames leaves instance roots alone, since that would rearrange the
component's children. The status line counts the instances kept as one layer, click it to see them.

The setting **Also change layers inside components** turns the boundary off. Then every layer
inside is written as an override, read back, and a value Figma silently keeps is reported as **not
overridable**. Frames without auto layout, grid frames and locked or hidden layers are skipped and
counted, never converted.

## Settings

The gear opens the few things that are set once: the constraints written by Fit to parent, skip
locked layers, skip hidden layers, also change layers inside components. Scope, the +frame checkbox and the settings
are stored in `figma.clientStorage`, so the window opens as it was left.

## What is out of scope

Aligning siblings on the canvas by moving their `x` and `y`, which is what Figma's align panel does.
Padding and gap, which are spacing rather than sizing and live in Tidy Sections.

## Development

```sh
npm install
npm run dev      # rebuild dist/ on every change
npm test         # unit tests for the pure logic, via the Node test runner
npm run preview  # render every built plugin UI in Figma light and dark in the browser
npm run build    # minified production build
npm run verify   # typecheck, lint, format check, test, build
```

Import the plugin in Figma via **Plugins > Development > Import plugin from manifest** and pick
`manifest.json`. The manifest points at `dist/`, so run a build at least once before importing.

The manifest needs its `id`. Without one Figma rejects `figma.clientStorage`, which takes the
settings down with it. The id in here is a locally generated one, good enough for development;
publishing replaces it with the id Figma issues.

## Layout

| Path              | Role                                                                       |
| ----------------- | -------------------------------------------------------------------------- |
| `src/main.ts`     | Sandbox side. Selection, runs the sections in order, reports back.         |
| `src/messages.ts` | Message contract and the settings shape shared by both sides.              |
| `src/settings.ts` | Settings in `figma.clientStorage`, sanitised, mapped to command options.   |
| `src/core/`       | Node classification, tree scope, guards, policy and the report. No Figma.  |
| `src/commands/`   | One file per section, working on the structural node type. Unit tested.    |
| `src/params/`     | Option types per command and their sanitising.                             |
| `src/ui/`         | Plugin window. `index.html` is a template, the build inlines CSS and JS.   |
| `ui-kit/`         | Shared design system of the sibling Figma plugin repos, synced from there. |

`core/` and `commands/` never import the `figma` global. They work on the structural `TreeNode`
type, which real Figma nodes satisfy and the test fakes satisfy too, so the classification, ordering
and guard logic runs under `node --test` without Figma.

`ui-kit/` is a copy. The canonical version lives in the sibling repo that carries a
`.ui-kit-canonical` marker. Edit it there and run `npm run sync:ui-kit` here.

What the tests cannot cover is Figma itself: that fill under a hugging parent is really rejected the
way the guard assumes, which nested instance writes Figma accepts as overrides, and the performance
on a screen with more than a thousand layers. Check those in a real file after importing.
