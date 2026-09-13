import { runAlign } from './commands/align.ts';
import { runFit } from './commands/fit.ts';
import { runHugFill } from './commands/hugFill.ts';
import { runText } from './commands/text.ts';
import type { RunContext } from './core/context.ts';
import type { Report } from './core/report.ts';
import type { TreeNode } from './core/types.ts';
import type { PluginMessage, ReportSummary, SelectionState, UiMessage } from './messages.ts';
import {
  labelFor,
  planFor,
  readSettings,
  sanitizeAction,
  sanitizeSettings,
  writeSettings,
} from './settings.ts';
import type { Plan } from './settings.ts';

figma.showUI(__html__, {
  width: 300,
  height: 640,
  title: 'Layout Toolkit',
  themeColors: true,
});

let running = false;

function send(message: PluginMessage): void {
  figma.ui.postMessage(message);
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function readSelection(): SelectionState {
  const selection = figma.currentPage.selection;
  return { count: selection.length, name: selection[0]?.name ?? '' };
}

async function loadFonts(node: TreeNode): Promise<boolean> {
  const text = node as unknown as TextNode;
  const fonts =
    text.fontName === figma.mixed
      ? text.characters.length > 0
        ? text.getRangeAllFontNames(0, text.characters.length)
        : []
      : [text.fontName];
  try {
    await Promise.all(fonts.map((font) => figma.loadFontAsync(font)));
    return true;
  } catch (error) {
    console.warn(`Layout Toolkit: font missing on ${node.name}`, error);
    return false;
  }
}

function execute(plan: Plan, roots: readonly TreeNode[], ctx: RunContext): Promise<Report> {
  switch (plan.command) {
    case 'hug-fill':
      return runHugFill(roots, plan.options, ctx);
    case 'fit':
      return runFit(roots, plan.options, ctx);
    case 'text':
      return runText(roots, plan.options, ctx);
    case 'align':
      return runAlign(roots, plan.options, ctx);
  }
}

function summarize(label: string, report: Report): ReportSummary {
  return {
    label,
    changed: report.changed,
    unchanged: report.unchanged,
    skipped: [...report.skipped.entries()]
      .map(([reason, layers]) => ({ reason, layers }))
      .sort((a, b) => b.layers.length - a.layers.length),
    instances: report.instances,
  };
}

async function run(rawAction: unknown, rawSettings: unknown): Promise<void> {
  if (running) return;
  const action = sanitizeAction(rawAction);
  if (action === null) {
    send({ type: 'error', message: 'Unknown action.' });
    return;
  }
  const settings = sanitizeSettings(rawSettings);
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    send({ type: 'error', message: 'Select a layer first.' });
    return;
  }

  running = true;
  figma.skipInvisibleInstanceChildren = settings.policy.skipHidden;
  send({ type: 'running' });
  const ctx: RunContext = { policy: settings.policy, loadFonts, tick };
  const label = labelFor(action);
  try {
    const report = await execute(
      planFor(action, settings),
      selection as unknown as TreeNode[],
      ctx,
    );
    if (report.notes.length > 0) {
      console.info(`Layout Toolkit · ${label}\n  ${report.notes.join('\n  ')}`);
    }
    for (const root of selection) {
      try {
        root.setRelaunchData({ open: '' });
      } catch {
        /* Relaunch data is a convenience, a layer that refuses it changes nothing about the run. */
      }
    }
    /* Every click is its own undo step, otherwise Figma folds the whole session into one. */
    figma.commitUndo();
    send({ type: 'report', report: summarize(label, report) });
  } catch (error) {
    console.error('Layout Toolkit failed', error);
    send({
      type: 'error',
      message: `${label} failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  } finally {
    running = false;
  }
}

async function select(id: string): Promise<void> {
  const node = await figma.getNodeByIdAsync(id);
  if (node === null || node.type === 'DOCUMENT' || node.type === 'PAGE') return;
  const scene = node;
  figma.currentPage.selection = [scene];
  figma.viewport.scrollAndZoomIntoView([scene]);
}

figma.ui.onmessage = (message: UiMessage) => {
  switch (message.type) {
    case 'run':
      void run(message.action, message.settings);
      return;
    case 'save-settings':
      void writeSettings(message.settings);
      return;
    case 'select':
      void select(message.id);
      return;
  }
};

figma.on('selectionchange', () => {
  send({ type: 'selection', selection: readSelection() });
});

void readSettings().then((settings) => {
  send({ type: 'init', settings, selection: readSelection() });
});
