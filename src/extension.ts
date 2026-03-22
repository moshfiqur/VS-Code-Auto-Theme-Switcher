import * as vscode from 'vscode';
import {
  DEFAULT_DARK,
  DEFAULT_HIGH_CONTRAST,
  DEFAULT_HIGH_CONTRAST_LIGHT,
  DEFAULT_LIGHT,
  readConfiguration,
  updateConfigurationEnums,
  updateThemePreference,
} from './configuration';
import { ThemeManager } from './themeManager';
import { ExtensionConfiguration, ThemeInfo } from './types';

let themeManager: ThemeManager;
let configuration: ExtensionConfiguration;
let statusBarItem: vscode.StatusBarItem;
let suppressThemeEvents = 0;
let manualOverride = false;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  themeManager = new ThemeManager();
  configuration = readConfiguration();
  updateConfigurationEnums(themeManager);

  await ensureAutoDetectEnabled();

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'autoThemeSwitcher.toggleTheme';
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveColorTheme((event) => handleSystemThemeChange(event.kind))
  );

  context.subscriptions.push(
    vscode.extensions.onDidChange(() => {
      themeManager.refreshThemes();
      updateConfigurationEnums(themeManager);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('autoThemeSwitcher')) {
        configuration = readConfiguration();
        updateStatusBar();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('autoThemeSwitcher.switchToLight', () =>
      applyConfiguredTheme(vscode.ColorThemeKind.Light, false)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('autoThemeSwitcher.switchToDark', () =>
      applyConfiguredTheme(vscode.ColorThemeKind.Dark, false)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('autoThemeSwitcher.selectThemes', () => selectThemes())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('autoThemeSwitcher.toggleTheme', () => toggleTheme())
  );

  await synchronizeWithSystemTheme(vscode.window.activeColorTheme.kind);
  updateStatusBar();
}

export function deactivate(): void {
  // nothing to clean up
}

async function handleSystemThemeChange(kind: vscode.ColorThemeKind): Promise<void> {
  if (suppressThemeEvents > 0) {
    suppressThemeEvents -= 1;
    return;
  }

  const normalizedKind = normalizeThemeKind(kind);
  if (shouldApplyAutoTheme(normalizedKind)) {
    manualOverride = false;
    await applyConfiguredTheme(normalizedKind, true);
    return;
  }

  manualOverride = true;
  updateStatusBar();
}

async function synchronizeWithSystemTheme(kind: vscode.ColorThemeKind): Promise<void> {
  const normalizedKind = normalizeThemeKind(kind);
  await applyConfiguredTheme(normalizedKind, true);
}

async function applyConfiguredTheme(
  kind: vscode.ColorThemeKind,
  fromSystemChange: boolean
): Promise<void> {
  if (!fromSystemChange) {
    manualOverride = false;
  }

  const themeLabel = resolvePreferredTheme(kind);
  const applied = await applyThemeWithFallback(themeLabel, kind);
  if (applied && configuration.notifyOnSwitch && fromSystemChange) {
    vscode.window.showInformationMessage(`Auto Theme Switcher applied: ${themeLabel}`);
  }
  updateStatusBar();
}

async function applyThemeWithFallback(
  preferredLabel: string,
  kind: vscode.ColorThemeKind
): Promise<boolean> {
  if (await applyThemeLabel(preferredLabel)) {
    return true;
  }

  const fallback = themeManager.getFallback(kind);
  if (fallback) {
    return applyThemeLabel(fallback.label);
  }

  const defaultLabel = defaultLabelForKind(kind);
  return applyThemeLabel(defaultLabel);
}

async function applyThemeLabel(label: string): Promise<boolean> {
  if (label === getWorkbenchThemeLabel()) {
    return true;
  }

  if (!themeManager.getThemeByLabel(label)) {
    return false;
  }

  suppressThemeEvents += 1;
  return themeManager.applyTheme(label);
}

function resolvePreferredTheme(kind: vscode.ColorThemeKind): string {
  if (kind === vscode.ColorThemeKind.Light) {
    return configuration.lightTheme || DEFAULT_LIGHT;
  }
  if (kind === vscode.ColorThemeKind.HighContrastLight) {
    return configuration.lightTheme || DEFAULT_HIGH_CONTRAST_LIGHT;
  }
  if (kind === vscode.ColorThemeKind.HighContrast) {
    return configuration.darkTheme || DEFAULT_HIGH_CONTRAST;
  }
  return configuration.darkTheme || DEFAULT_DARK;
}

function defaultLabelForKind(kind: vscode.ColorThemeKind): string {
  switch (kind) {
    case vscode.ColorThemeKind.Light:
      return DEFAULT_LIGHT;
    case vscode.ColorThemeKind.HighContrastLight:
      return DEFAULT_HIGH_CONTRAST_LIGHT;
    case vscode.ColorThemeKind.HighContrast:
      return DEFAULT_HIGH_CONTRAST;
    case vscode.ColorThemeKind.Dark:
    default:
      return DEFAULT_DARK;
  }
}

async function selectThemes(): Promise<void> {
  const lightPick = await promptForTheme(
    vscode.ColorThemeKind.Light,
    'Select your preferred light theme'
  );
  if (lightPick) {
    await updateThemePreference('lightTheme', lightPick.label);
  }

  const darkPick = await promptForTheme(
    vscode.ColorThemeKind.Dark,
    'Select your preferred dark theme'
  );
  if (darkPick) {
    await updateThemePreference('darkTheme', darkPick.label);
  }

  configuration = readConfiguration();
  await synchronizeWithSystemTheme(vscode.window.activeColorTheme.kind);
}

async function promptForTheme(
  kind: vscode.ColorThemeKind,
  placeHolder: string
): Promise<ThemeInfo | undefined> {
  const themes = themeManager.getThemesByKind(kind);
  const picks = themes.map((theme) => ({
    label: theme.label,
    description: theme.extensionId,
    theme,
  }));

  const selection = await vscode.window.showQuickPick(picks, {
    placeHolder,
    matchOnDescription: true,
  });

  return selection?.theme;
}

async function toggleTheme(): Promise<void> {
  const currentKind = normalizeThemeKind(vscode.window.activeColorTheme.kind);
  const nextKind =
    currentKind === vscode.ColorThemeKind.Light
      ? vscode.ColorThemeKind.Dark
      : vscode.ColorThemeKind.Light;

  await applyConfiguredTheme(nextKind, false);
}

function updateStatusBar(): void {
  if (!configuration.statusBarEnabled) {
    statusBarItem.hide();
    return;
  }

  const rawKind = vscode.window.activeColorTheme.kind;
  const preferred = resolvePreferredTheme(normalizeThemeKind(rawKind));
  const displayLabel = manualOverride ? getWorkbenchThemeLabel() : preferred;
  const icon = getIconForKind(rawKind);
  statusBarItem.text = `${icon} ${displayLabel}`;
  statusBarItem.tooltip = manualOverride
    ? 'Auto Theme Switcher (manual override active)'
    : 'Auto Theme Switcher (click to toggle)';
  statusBarItem.show();
}

function normalizeThemeKind(kind: vscode.ColorThemeKind): vscode.ColorThemeKind {
  if (kind === vscode.ColorThemeKind.HighContrastLight) {
    return vscode.ColorThemeKind.Light;
  }
  if (kind === vscode.ColorThemeKind.HighContrast) {
    return vscode.ColorThemeKind.Dark;
  }
  return kind;
}

function getIconForKind(kind: vscode.ColorThemeKind): string {
  switch (kind) {
    case vscode.ColorThemeKind.Light:
      return '$(sun)';
    case vscode.ColorThemeKind.HighContrast:
    case vscode.ColorThemeKind.HighContrastLight:
      return '$(color-mode)';
    case vscode.ColorThemeKind.Dark:
    default:
      return '$(moon)';
  }
}

function shouldApplyAutoTheme(kind: vscode.ColorThemeKind): boolean {
  if (!isAutoDetectEnabled()) {
    return false;
  }

  const preferred = getPreferredThemeLabel(kind);
  if (!preferred) {
    return false;
  }

  return getWorkbenchThemeLabel() !== preferred;
}

function isAutoDetectEnabled(): boolean {
  return vscode.workspace
    .getConfiguration('window')
    .get<boolean>('autoDetectColorScheme', false);
}

async function ensureAutoDetectEnabled(): Promise<void> {
  if (isAutoDetectEnabled()) {
    return;
  }

  const enable = 'Enable OS Theme Auto-Detect';
  const response = await vscode.window.showWarningMessage(
    'Auto Theme Switcher needs OS theme auto-detect. Enable it now?',
    enable
  );

  if (response === enable) {
    await vscode.workspace
      .getConfiguration('window')
      .update('autoDetectColorScheme', true, vscode.ConfigurationTarget.Global);
  }
}

function getPreferredThemeLabel(kind: vscode.ColorThemeKind): string | undefined {
  const config = vscode.workspace.getConfiguration('workbench');
  if (kind === vscode.ColorThemeKind.Light) {
    return config.get<string>('preferredLightColorTheme');
  }
  return config.get<string>('preferredDarkColorTheme');
}

function getWorkbenchThemeLabel(): string {
  return (
    vscode.workspace.getConfiguration('workbench').get<string>('colorTheme') || ''
  );
}
