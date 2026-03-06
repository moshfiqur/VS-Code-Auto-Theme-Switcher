# VS Code Auto Theme Switcher

Automatically switch between your preferred light and dark themes based on the operating system theme.

## Features

- Choose any installed theme for light and dark modes.
- Automatically applies the correct theme when the system theme changes.
- Commands to force light/dark, toggle, and select themes from a quick pick.
- Status bar indicator showing the active preference (click to toggle).
- Notifies you when an automatic switch occurs (configurable).

## Commands

- `Auto Theme Switcher: Switch to Light Theme`
- `Auto Theme Switcher: Switch to Dark Theme`
- `Auto Theme Switcher: Toggle Light/Dark`
- `Auto Theme Switcher: Select Light and Dark Themes`

## Settings

- `autoThemeSwitcher.lightTheme` – preferred light theme.
- `autoThemeSwitcher.darkTheme` – preferred dark theme.
- `autoThemeSwitcher.notifyOnSwitch` – show a notification when auto-switching.
- `autoThemeSwitcher.statusBarEnabled` – show a status bar indicator.

The extension populates the theme dropdowns with installed themes at activation. Use the **Select Light and Dark Themes** command for a guided quick pick.

## Development

```bash
npm install
npm run compile
```

Launch the extension in VS Code using the `Run Extension` debug configuration.
