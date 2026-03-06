import * as vscode from 'vscode';
import { ThemeInfo } from './types';

export class ThemeManager {
  private themes: ThemeInfo[] = [];

  constructor() {
    this.refreshThemes();
  }

  refreshThemes(): void {
    const discovered: ThemeInfo[] = [];

    vscode.extensions.all.forEach((ext) => {
      const themes = ext.packageJSON?.contributes?.themes as Array<{
        id?: string;
        label?: string;
        uiTheme?: string;
        path?: string;
      }> | undefined;

      if (!themes) {
        return;
      }

      themes.forEach((theme) => {
        const uiTheme = (theme.uiTheme || '').toLowerCase();
        const label = theme.label || theme.id || 'Unknown Theme';
        const id = `${ext.id}:${label}`;
        discovered.push({
          id,
          label,
          uiTheme,
          kind: this.resolveKind(uiTheme),
          extensionId: ext.id,
          path: theme.path,
        });
      });
    });

    const unique = new Map<string, ThemeInfo>();
    // prefer later entries (user installed extensions typically appear later)
    discovered.forEach((theme) => unique.set(theme.label, theme));
    this.themes = Array.from(unique.values()).sort((a, b) => a.label.localeCompare(b.label));
  }

  getAllThemes(): ThemeInfo[] {
    return [...this.themes];
  }

  getThemesByKind(kind: vscode.ColorThemeKind): ThemeInfo[] {
    return this.themes.filter((theme) => theme.kind === kind);
  }

  getThemeByLabel(label: string): ThemeInfo | undefined {
    return this.themes.find((theme) => theme.label === label);
  }

  async applyTheme(label: string): Promise<boolean> {
    const target = this.getThemeByLabel(label);
    if (!target) {
      return false;
    }

    await vscode.workspace
      .getConfiguration('workbench')
      .update('colorTheme', target.label, vscode.ConfigurationTarget.Global);

    return true;
  }

  getFallback(kind: vscode.ColorThemeKind): ThemeInfo | undefined {
    return this.getThemesByKind(kind)[0] ?? this.themes[0];
  }

  private resolveKind(uiTheme: string): vscode.ColorThemeKind {
    switch (uiTheme) {
      case 'vs':
        return vscode.ColorThemeKind.Light;
      case 'hc':
        return vscode.ColorThemeKind.HighContrast;
      case 'hc-light':
        return vscode.ColorThemeKind.HighContrastLight;
      case 'vs-dark':
      default:
        return vscode.ColorThemeKind.Dark;
    }
  }
}
