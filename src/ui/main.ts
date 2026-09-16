import './styles.css';
import {
  bindSegmented,
  byId,
  clear,
  onPluginMessage,
  postToPlugin,
  setVisible,
} from '../../ui-kit/kit.ts';
import type { LayerRef } from '../core/report.ts';
import { DEFAULT_SETTINGS } from '../messages.ts';
import type {
  Action,
  PluginMessage,
  ReportSummary,
  SelectionState,
  Settings,
  UiMessage,
} from '../messages.ts';
import type { Edge } from '../params/options.ts';

const MAX_LAYERS_PER_REASON = 10;

const el = {
  selectionName: byId('selectionName'),
  selectionCount: byId('selectionCount'),
  openSettings: byId<HTMLButtonElement>('openSettings'),
  closeSettings: byId<HTMLButtonElement>('closeSettings'),
  settingsView: byId('settingsView'),
  scopeGroup: byId('scopeGroup'),
  textFrame: byId<HTMLInputElement>('textFrame'),
  borderWholePage: byId<HTMLInputElement>('borderWholePage'),
  borderSkipComponents: byId<HTMLInputElement>('borderSkipComponents'),
  alignGrid: byId('alignGrid'),
  notice: byId('notice'),
  reportSummary: byId<HTMLButtonElement>('reportSummary'),
  reportDetails: byId('reportDetails'),
  fitConstraints: byId<HTMLSelectElement>('fitConstraints'),
  skipLocked: byId<HTMLInputElement>('skipLocked'),
  skipHidden: byId<HTMLInputElement>('skipHidden'),
  insideComponents: byId<HTMLInputElement>('insideComponents'),
};

let settings: Settings = structuredClone(DEFAULT_SETTINGS);
let selection: SelectionState = { count: 0, name: '' };
let running = false;
let lastAlign: { h: Edge; v: Edge } | null = null;
let hasReport = false;

const actionButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action]'));

function actionOf(button: HTMLButtonElement): Action | null {
  return JSON.parse(button.dataset.action ?? 'null') as Action | null;
}

/* The only buttons that may run without a selection, and only while their own checkbox is on. */
const pageButtons = new Set(actionButtons.filter((b) => actionOf(b)?.kind === 'border'));

function send(message: UiMessage): void {
  postToPlugin(message);
}

function persist(): void {
  send({ type: 'save-settings', settings });
}

function run(action: Action): void {
  if (running) return;
  const reachesPage = action.kind === 'border' && settings.borderWholePage;
  if (selection.count === 0 && !reachesPage) return;
  send({ type: 'run', action, settings });
}

function syncEnabled(): void {
  const disabled = running || selection.count === 0;
  for (const button of actionButtons) {
    const reachesPage = settings.borderWholePage && pageButtons.has(button);
    button.disabled = running || (selection.count === 0 && !reachesPage);
  }
  for (const dot of Array.from(el.alignGrid.querySelectorAll<HTMLButtonElement>('.align-dot'))) {
    dot.disabled = disabled;
  }
}

function syncHeader(): void {
  if (selection.count === 0) {
    el.selectionName.textContent = 'Nothing selected';
    el.selectionCount.textContent = '';
    return;
  }
  el.selectionName.textContent = selection.name;
  el.selectionCount.textContent = selection.count === 1 ? '1 layer' : `${selection.count} layers`;
}

const EDGE_TO_POS: Record<Edge, string> = { MIN: 'start', CENTER: 'center', MAX: 'end' };
const EDGES: readonly Edge[] = ['MIN', 'CENTER', 'MAX'];
const POS_LABEL: Record<Edge, [string, string]> = {
  MIN: ['left', 'top'],
  CENTER: ['center', 'center'],
  MAX: ['right', 'bottom'],
};

function renderAlignGrid(): void {
  for (const v of EDGES) {
    for (const h of EDGES) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'align-dot';
      dot.dataset.h = EDGE_TO_POS[h];
      dot.dataset.v = EDGE_TO_POS[v];
      dot.title = `Align ${POS_LABEL[v][1]} ${POS_LABEL[h][0]}`;
      dot.setAttribute('aria-label', dot.title);
      dot.setAttribute('aria-pressed', 'false');
      dot.addEventListener('click', () => {
        lastAlign = { h, v };
        syncAlignGrid();
        run({ kind: 'align', h, v });
      });
      el.alignGrid.appendChild(dot);
    }
  }
}

function syncAlignGrid(): void {
  const h = lastAlign ? EDGE_TO_POS[lastAlign.h] : '';
  const v = lastAlign ? EDGE_TO_POS[lastAlign.v] : '';
  el.alignGrid.dataset.h = h;
  el.alignGrid.dataset.v = v;
  for (const dot of Array.from(el.alignGrid.querySelectorAll<HTMLButtonElement>('.align-dot'))) {
    dot.setAttribute('aria-pressed', String(dot.dataset.h === h && dot.dataset.v === v));
  }
}

function writeForm(next: Settings): void {
  settings = structuredClone(next);
  selectScope(settings.scope);
  el.textFrame.checked = settings.textFrame;
  el.borderWholePage.checked = settings.borderWholePage;
  el.borderSkipComponents.checked = settings.borderSkipComponents;
  el.fitConstraints.value = settings.fitConstraints;
  el.skipLocked.checked = settings.policy.skipLocked;
  el.skipHidden.checked = settings.policy.skipHidden;
  el.insideComponents.checked = settings.policy.insideComponents;
}

function setSummary(kind: 'info' | 'success' | 'error', text: string, expandable: boolean): void {
  el.notice.className =
    kind === 'info' ? 'fig-notice report' : `fig-notice fig-notice--${kind} report`;
  el.notice.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.reportSummary.textContent = text;
  el.reportSummary.classList.toggle('report__summary--expandable', expandable);
  el.reportSummary.setAttribute('aria-expanded', 'false');
  setVisible(el.reportDetails, false);
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function showReport(report: ReportSummary): void {
  const skipped = report.skipped.reduce((sum, group) => sum + group.layers.length, 0);
  let text: string;
  if (report.changed === 0 && skipped === 0) {
    text = report.unchanged > 0 ? 'Already matched' : 'Nothing to do';
  } else {
    text = `${plural(report.changed, 'layer')} changed`;
    if (skipped > 0) text += ` · ${skipped} skipped`;
  }
  if (report.instances.length > 0) text += ` · ${plural(report.instances.length, 'instance')}`;
  if (report.bordered.length > 0) text += ` · ${report.bordered.length} with a border`;
  const groups: { title: string; layers: LayerRef[] }[] = report.skipped.map((group) => ({
    title: `${plural(group.layers.length, 'layer')} ${group.reason}`,
    layers: group.layers,
  }));
  if (report.instances.length > 0) {
    groups.push({
      title: `${plural(report.instances.length, 'instance')} kept as one layer`,
      layers: report.instances,
    });
  }
  if (report.bordered.length > 0) {
    groups.push({
      title: `${plural(report.bordered.length, 'frame')} with a visible border, so the size moved`,
      layers: report.bordered,
    });
  }
  setSummary(
    skipped === 0 && report.changed > 0 ? 'success' : 'info',
    `${report.label}: ${text}`,
    groups.length > 0,
  );

  clear(el.reportDetails);
  for (const group of groups) {
    const reason = document.createElement('div');
    reason.className = 'report__reason';
    reason.textContent = group.title;
    const layers = document.createElement('div');
    layers.className = 'report__layers';
    for (const layer of group.layers.slice(0, MAX_LAYERS_PER_REASON)) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'report__layer';
      chip.textContent = layer.name;
      chip.title = `Select ${layer.name}`;
      chip.addEventListener('click', () => send({ type: 'select', id: layer.id }));
      layers.appendChild(chip);
    }
    const rest = group.layers.length - MAX_LAYERS_PER_REASON;
    if (rest > 0) {
      const more = document.createElement('span');
      more.className = 'report__more';
      more.textContent = `and ${rest} more`;
      layers.appendChild(more);
    }
    el.reportDetails.append(reason, layers);
  }
}

function showIdle(): void {
  if (selection.count === 0) {
    hasReport = false;
    const text = settings.borderWholePage
      ? 'Border runs on the whole page. Every other action needs a selection.'
      : 'Select a layer to start.';
    setSummary('info', text, false);
  } else if (!hasReport) {
    setSummary('info', 'Click an action. Every click is one undo step.', false);
  }
}

el.reportSummary.addEventListener('click', () => {
  if (!el.reportSummary.classList.contains('report__summary--expandable')) return;
  const open = el.reportDetails.hidden;
  setVisible(el.reportDetails, open);
  el.reportSummary.setAttribute('aria-expanded', String(open));
});

for (const button of actionButtons) {
  button.setAttribute('aria-label', button.title);
  button.addEventListener('click', () => {
    const action = actionOf(button);
    if (action !== null) run(action);
  });
}

const selectScope = bindSegmented(el.scopeGroup, (value) => {
  settings.scope = value as Settings['scope'];
  persist();
});

function bindToggle(input: HTMLInputElement, write: (checked: boolean) => void): void {
  input.addEventListener('change', () => {
    write(input.checked);
    persist();
  });
}

bindToggle(el.textFrame, (on) => (settings.textFrame = on));
bindToggle(el.borderSkipComponents, (on) => (settings.borderSkipComponents = on));
bindToggle(el.borderWholePage, (on) => {
  settings.borderWholePage = on;
  syncEnabled();
  showIdle();
});
bindToggle(el.skipLocked, (on) => (settings.policy = { ...settings.policy, skipLocked: on }));
bindToggle(el.skipHidden, (on) => (settings.policy = { ...settings.policy, skipHidden: on }));
bindToggle(
  el.insideComponents,
  (on) => (settings.policy = { ...settings.policy, insideComponents: on }),
);

el.fitConstraints.addEventListener('change', () => {
  settings.fitConstraints = el.fitConstraints.value as Settings['fitConstraints'];
  persist();
});

el.openSettings.addEventListener('click', () => {
  setVisible(el.settingsView, true);
  el.closeSettings.focus();
});

el.closeSettings.addEventListener('click', () => {
  setVisible(el.settingsView, false);
  el.openSettings.focus();
});

document.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape' && !el.settingsView.hidden) el.closeSettings.click();
});

onPluginMessage<PluginMessage>((message) => {
  switch (message.type) {
    case 'init':
      writeForm(message.settings);
      selection = message.selection;
      syncHeader();
      syncEnabled();
      showIdle();
      return;
    case 'selection':
      selection = message.selection;
      syncHeader();
      syncEnabled();
      showIdle();
      return;
    case 'running':
      running = true;
      syncEnabled();
      return;
    case 'report':
      running = false;
      hasReport = true;
      syncEnabled();
      showReport(message.report);
      return;
    case 'error':
      running = false;
      hasReport = true;
      syncEnabled();
      setSummary('error', message.message, false);
      return;
  }
});

renderAlignGrid();
writeForm(DEFAULT_SETTINGS);
syncHeader();
syncEnabled();
