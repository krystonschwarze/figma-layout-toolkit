# Layout Toolkit

Figma plugin with a palette of one click actions for whole layer trees: hug, fill and fixed sizing
per axis, text alignment and resizing, alignment of auto layout frames, and fit to parent. Every
button does one thing to everything nested under the selection. What used to be dozens of clicks in
the properties panel is one.

## What it does

Select one or more layers and open the plugin. There is nothing to configure and no Apply, every
button writes right away as its own undo step, and the window stays open.

- **Sizing.** Hug, fill and fixed per axis, plus **Auto**, which hugs along the axis the parent
  stacks on and fills across it.
- **Text.** Alignment for every text layer in scope, optionally moving the parent frame with it, and
  three resize buttons.
- **Align frames.** A nine dot picker that aligns the children of every auto layout frame, mapped
  per frame because the axis names flip with the layout direction.
- **Fit to parent.** Stretches free and absolutely positioned layers to their parent, with the
  constraints from the settings.
- **Border in layout.** Sets every auto layout frame to **Included** or **Excluded**, the switch
  Figma added when it moved auto layout closer to the CSS box model. A checkbox takes the whole
  page instead of the selection, another leaves components and instances alone, except for what
  you selected yourself.
- **Scope** switches between the selection with its descendants, only what is inside, or only the
  selected layers themselves.
- The status line names the last action and counts what changed and what was skipped. Click it to
  see the skipped layers by reason and select them on the canvas.

An instance counts as one layer, so a Button keeps its label and a Badge keeps its padding. A setting
turns that boundary off.

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

## Documentation

- [docs/reference.md](docs/reference.md): every button, the instance rules, the settings and the source layout.
- [ui-kit/README.md](ui-kit/README.md): the shared design system.
