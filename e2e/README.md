# E2E (Playwright + Electron)

End-to-end specs that drive the **built** app via Playwright's `_electron` launcher — the
house standard for cross-boundary behavior Vitest can't reach (disk round-trips, real window
geometry, full themed renders). Full rationale + patterns:
`Comhaigne/docs/architecture/e2e-playwright-electron.md`.

## Running

```bash
npm run e2e        # builds (electron-vite) then runs all specs
npm run e2e:only   # runs specs against the existing out/ build
```

The `e2e` job in `release.yml` runs these on every PR, on a Windows runner. Windows runners have
a real desktop session, so no virtual display (xvfb) is needed.

## What's here

- **`helpers.js`** — the reusable harness:
  - `launchApp({ seedSettings?, localAppData? })` — launches the built app, strips
    `ELECTRON_RUN_AS_NODE`, and redirects `%LOCALAPPDATA%` to a temp dir so runs are hermetic.
    Reuse `localAppData` across two launches to test persistence.
  - `getMainWindow(app)` — skips the splash and returns the real main window. It finds it by the
    preload bridge (`window.electron` / `window.electronAPI`), present on the app window and
    absent on the splash.
  - `readGeometry(app, page, selector?)` — native window bounds + a DOM element's on-screen
    left edge, for measuring layout/offsets.
- **`app-boot.spec.js`** — smoke: splash → main window revealed → hydrated UI on screen.
- **`settings-persistence.spec.js`** — change theme via the IPC bridge → wait for the write to
  hit disk → relaunch same userData → assert it hydrated. The full renderer → IPC → disk →
  reload loop.

## Adapting / extending

- **`USERDATA_SUBPATH`** in `helpers.js` must match `src/main/index.js`'s userData dir
  (`['Erisco', 'Creidhne']`).
- Add specs for behavior the app actually has. Good candidates: theme-switch smoke (all six
  themes render, no `pageerror`), window-geometry invariants, filesystem-effecting IPC flows
  against a temp dir (index build/delete, archive/trash).

## Gotchas

1. `ELECTRON_RUN_AS_NODE` set in env → Electron boots as plain Node and crashes at
   `app.setPath`. `launchApp` strips it.
2. Splash window → `firstWindow()` can grab it. `getMainWindow` selects by the preload bridge.
3. Main window is hidden until the renderer signals `app:ready` → wait for `isVisible()`.
4. Test the **built** app; rebuild after any `src/` change (`npm run e2e` does `build &&` first).
