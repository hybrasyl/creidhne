# Authority model

This document tells how Creidhne's main process decides which folders and programs the renderer may use. It fixes HTOO-679 and HTOO-681. Taliesin has the same model (its `docs/authority-model.md`, HTOO-673 to HTOO-675). Keep the two aligned.

## The rule

The renderer writes settings.json. So settings.json is not the record of what the renderer may touch. Main keeps that record in `grants.json`, and only main writes it.

## The parts

| Part            | Where                                                   | What it holds                                                                             |
| --------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `grants.json`   | Beside settings.json (`%LOCALAPPDATA%\Erisco\Creidhne`) | `version`, `dirs` (granted folders), `executables.taliesin` (path, size, mtime, SHA-256)  |
| `blessedRoots`  | Memory, this session only (`handlerContext.js`)         | Every path a native dialog returned, and the Brigid assets folder that main suggests      |
| `settingsRoots` | Memory (`handlerContext.js`)                            | The settings paths that a grant or a blessed root covers, and each library's world folder |
| `authorizePath` | `handlerContext.js`; `validatePath` in `index.js`       | The check that every renderer path goes through                                           |

## How a folder gets authority

1. The user chooses it in a native dialog (`open-directory`, `dialog:openFile`, `dialog:saveFile`, `formulas:import`). Main adds the result to `blessedRoots`.
2. The renderer saves settings that name the folder. `settings:save` keeps a settings path as a root only when it is inside a grant or inside `blessedRoots`. It then sets `grants.dirs` to the settings paths it kept, and writes `grants.json`. So a folder that the settings no longer name loses its grant.
3. At the next start, main loads `grants.json` before it registers any IPC handler.

A settings path with no grant is saved, but it is not a root. Main writes it to the session log.

A filesystem root (`/`, `C:\`, `\\server\share\`) is never a root, a grant or a blessed path. A library's world folder is not added when it is a filesystem root.

The installed `.datf` packs load only from a pack folder that is a current root.

## The one-time migration

When `grants.json` does not exist, main reads the folders and the Taliesin path in settings.json, grants them, and writes `grants.json`. This happens once, at the first start of the version that has this model. A `grants.json` that does not parse gives an empty grant set (fail closed), and main logs it.

## The Taliesin program

No IPC channel takes a program path.

- `dialog:openExeFile` is the approval: main shows the dialog, measures the file (size, mtime, SHA-256) and records it in `grants.json`. A directory (a macOS `.app` bundle) is recorded without a hash. The picked path is not a folder root.
- `settings:save` with `taliesinPath: null` removes the record. Any other value from the renderer is replaced by the recorded path.
- `settings:load` returns `taliesinPath` from the record. The field in settings.json is only a copy for display.
- Before each launch, main checks the record. When the size and the mtime are the same, the file runs. When either changed, main hashes the file again. If the hash is different, the file does not run (`reason: 'changed'`), and the user must choose it again.

## Path checks

`authorizePath(p)` checks every path the renderer sends:

1. The path is inside a root, as a string.
2. Its real path (junctions and symlinks resolved; for a new path, the real path of its nearest existing parent) is inside the real path of a root. A link from one root into another root passes. A root that is itself a link passes, because the user chose it.
3. Its real path is not in the settings folder, and is not the approved Taliesin program.

The check is synchronous (`realpathSync.native`), so each handler keeps its one-line `validatePath(p)` call.

Main also checks the paths that it computes under a checked folder before it writes:

- `validateLibraryForWrite` (`index.js`) checks `.creidhne/`, `scripts/` and `.staging/` beside the library, for the handlers that write there.
- Archive, unarchive, Stage, Release and the rename repair take `validatePath` as a guard and check each destination before the move or the write.

## Script opening

`script:open` runs no command shell (HTOO-680, `scriptOpen.js`). Main finds VS Code itself: `Code.exe` beside the `code.cmd` on PATH on Windows, `code` on PATH elsewhere. It starts it with an argument array. When it finds no VS Code, the OS default program opens the file.

## What stays open

- **A race.** A folder can change into a link between the check and the I/O. The check closes every case where the link exists first, which is the case the review showed.
- **Walks.** The index build (hybindex-ts) and the reference scan read every file below a library. A link below the library that leads out is read. The writes are checked, the reads of a walk are not.
- **A macOS `.app` Taliesin** is recorded without a hash. Main checks only that it is still a directory.

## Tests

- `src/main/__tests__/authority.test.js`: real directories, real junctions (Windows) or symlinks, and the real grant file. A forged save, the program check, the settings folder, the migration, and links below a root for read, write, move, archive, Stage and the rename repair.
- `src/main/__tests__/handlerContext.test.js`: the root sets and the save reconciliation.
- `src/main/__tests__/scriptOpen.test.js`: a real process with hostile file names, and no `shell: true` in main.
- `e2e/settings-authority.spec.js`: a forged save in the built app, and the settings folder through a granted parent.
