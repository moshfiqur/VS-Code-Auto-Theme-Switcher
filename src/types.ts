import { ColorThemeKind } from 'vscode';

export interface ThemeInfo {
  id: string;
  label: string;
  uiTheme: string;
  kind: ColorThemeKind;
  extensionId: string;
  path?: string;
}

export interface ExtensionConfiguration {
  lightTheme: string;
  darkTheme: string;
  notifyOnSwitch: boolean;
  statusBarEnabled: boolean;
}
