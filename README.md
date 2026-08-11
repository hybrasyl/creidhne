# Creidhne

A desktop XML editor for [Hybrasyl](https://www.hybrasyl.com) server content. Manages the full range of world data files — items, castables, creatures, NPCs, loot, statuses, nations, spawn groups, behaviors, variants, localization strings, element tables, recipes, and server config — with a consistent interface for creating, editing, archiving, and exporting.

Built with Electron + React + MUI.

## Features

- **Multi-library support** — manage multiple world folders, switch between them without restarting
- **Full editor coverage** — dedicated editors for every Hybrasyl XML type
- **Constants system** — shared category/value lists kept in sync across editors
- **Cross-reference** — "used by" lookups across the loaded library
- **Exports** — castable data to CSV and JSON
- **Formula editor** — import and manage formulas from Lua-exported formula lists
- **Sprite picker** — visual sprite selection for creatures and NPCs
- **Unsaved changes guard** — prompts before navigating away or closing

> **Note:** Map and world map editing are out of scope for Creidhne. That functionality is planned for **Taliesin**, a separate tool currently in development.

## Installation

Pre-built releases for Windows are available on the [releases page](https://github.com/hybrasyl/creidhne/releases).

### Over Remote Desktop

A Remote Desktop session has no GPU, so Creidhne turns hardware acceleration off and
drops the themes' panel blur when it detects one. Window dragging and scrolling stay
smooth as a result.

**Detection can miss a reconnected session, and this is the case to know about.**
Windows writes `%SESSIONNAME%` when you log on and never revises it. If you connect
to a machine that already has your session open at the console, Windows _reconnects_
that session instead of creating a new one — so every program keeps reporting
`Console` while running over Remote Desktop. That is what happens to anyone who
leaves a machine logged in and connects to it later.

Set `CREIDHNE_DISABLE_GPU=1` before you start Creidhne to force software rendering,
or `CREIDHNE_DISABLE_GPU=0` to force acceleration back on if the detection is wrong
on your machine.

```cmd
set CREIDHNE_DISABLE_GPU=1
creidhne.exe
```

Parsec, Sunshine, VNC and other non-Remote-Desktop tools are not detected. Use the
variable there too.

## Building from source

```bash
npm install
npm run dev          # development
npm run build:win    # Windows installer
npm run build:linux  # Linux (untested)
```

Node.js is only required if you are building from source. Any recent Node.js version (18+) should work; development is done on Node 24.

## Project structure

| Path                           | Purpose                                                             |
| ------------------------------ | ------------------------------------------------------------------- |
| `src/main/`                    | Electron main process — IPC handlers, XML parse/serialize, file I/O |
| `src/renderer/src/pages/`      | One page component per editor                                       |
| `src/renderer/src/components/` | Shared and editor-specific components                               |
| `xsd/`                         | XSD schemas for all Hybrasyl XML types                              |

## Contributing

Issues and pull requests welcome. Please open an issue before starting significant work.

## Author

[Caeldeth](https://github.com/Caeldeth)

## License

See [LICENSE](LICENSE) for details.
