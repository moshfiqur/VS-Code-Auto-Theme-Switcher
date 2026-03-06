import * as vscode from 'vscode';
import { ExtensionConfiguration } from './types';
import { ThemeManager } from './themeManager';

const CONFIG_SECTION = 'autoThemeSwitcher';

export const DEFAULT_LIGHT = 'Default Light+';
export const DEFAULT_DARK = 'Default Dark+';
export const DEFAULT_HIGH_CONTRAST = 'Default High Contrast';
export const DEFAULT_HIGH_CONTRAST_LIGHT = 'Default High Contrast Light';

export function readConfiguration(): ExtensionConfiguration {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

  return {
    lightTheme: config.get<string>('lightTheme', DEFAULT_LIGHT),
    darkTheme: config.get<string>('darkTheme', DEFAULT_DARK),
    notifyOnSwitch: config.get<boolean>('notifyOnSwitch', true),
    statusBarEnabled: config.get<boolean>('statusBarEnabled', true),
  };
}

export async function updateThemePreference(
  key: 'lightTheme' | 'darkTheme',
  value: string
): Promise<void> {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  await config.update(key, value, vscode.ConfigurationTarget.Global);
}

export function updateConfigurationEnums(themeManager: ThemeManager): void {
  const extension = vscode.extensions.getExtension('moshfiqur.auto-theme-switcher');
  if (!extension) {
    return;
  }

  const themeLabels = themeManager.getAllThemes().map((theme) => theme.label);
  const packageJSON: any = extension.packageJSON;
  const properties = packageJSON?.contributes?.configuration?.properties;
  if (!properties) {
    return;
  }

  const sorted = [...themeLabels].sort((a, b) => a.localeCompare(b));
  if (properties['autoThemeSwitcher.lightTheme']) {
    properties['autoThemeSwitcher.lightTheme'].enum = sorted;
  }
  if (properties['autoThemeSwitcher.darkTheme']) {
    properties['autoThemeSwitcher.darkTheme'].enum = sorted;
  }
}
