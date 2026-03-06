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

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  themeManager = new ThemeManager();
  configuration = readConfiguration();
  updateConfigurationEnums(themeManager);

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
  await synchronizeWithSystemTheme(kind);
}

async function synchronizeWithSystemTheme(kind: vscode.ColorThemeKind): Promise<void> {
  const normalizedKind = normalizeThemeKind(kind);
  await applyConfiguredTheme(normalizedKind, true);
}

async function applyConfiguredTheme(
  kind: vscode.ColorThemeKind,
  fromSystemChange: boolean
): Promise<void> {
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
  if (await themeManager.applyTheme(preferredLabel)) {
    return true;
  }

  const fallback = themeManager.getFallback(kind);
  if (fallback) {
    return themeManager.applyTheme(fallback.label);
  }

  const defaultLabel = defaultLabelForKind(kind);
  return themeManager.applyTheme(defaultLabel);
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

  const activeKind = normalizeThemeKind(vscode.window.activeColorTheme.kind);
  const preferred = resolvePreferredTheme(activeKind);
  const icon = getIconForKind(activeKind);
  statusBarItem.text = `${icon} ${preferred}`;
  statusBarItem.tooltip = 'Auto Theme Switcher (click to toggle)';
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
