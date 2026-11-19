# Release testing: changes since 1.15.0

These are the checks by hand that the next release needs: each change in `CHANGELOG.md` under `[Unreleased]` that the automated gate cannot see. Tick each item when it is done, and write the build, the tester and the date beside it. The record of 1.14.0 and 1.15.0 is this file at the tag `v1.15.0`.

A check that is ticked on a platform is done. The next release does not list it again on that platform unless its code changes (Sabrael, 2026-11-19). A check that needs hardware that is not at the machine is written as "not available", not owed.

Each check names its tracker card in the document repo. Write the result as a comment on that card too.

The automated gate is green on Windows at `72303d3`: `lint:check`, `npm test` (3046 passed, 21 skipped), `build` and `e2e` (32 passed, 5 skipped). On a fresh clone, and after the pin in `scripts/xsdRef.cjs` moves, run `npm run fetch-xsd` before `npm test`. Run `unset ELECTRON_RUN_AS_NODE` in each shell that builds or runs e2e.

## Already covered by e2e

These run on each `npm run e2e`, so they need no pass by hand. On macOS and Linux, run `npm run e2e` once and report the counts.

- A pack icon in the Sprite field, and a pick from the picker with packs and no client folder (`item-icon-packs.spec.js`, HTOO-695)
- The old world indexes in Settings → World indexes, and their removal (`index-caches.spec.js`)
- A settings save that names a new folder does not get access to it (`settings-authority.spec.js`, HTOO-679)
- The preload stays sandboxed, and the IPC guard holds (`preload-sandbox.spec.js`, `ipc-guard.spec.js`)
- Every page opens (`nav-pages.spec.js`), the macOS menu (`app-menu.spec.js`), and close while another app is in front (`close-unfocused.spec.js`)

## Any platform

Use a packaged build. The checks marked "upgrade" need a machine that had 1.15.0 installed, with a world, a client folder and a Taliesin program set in Settings.

- [x] **Upgrade: Creidhne keeps its access (HTOO-679).** Install the new build over 1.15.0 and start it. The world opens, the client sprites draw, and Open in Taliesin starts Taliesin. `grants.json` is now beside `settings.json`. Nothing asks you to choose a folder again. Linux Mint 22.3, packaged build at `2c634fd`, Sabrael, 2026-11-19: pass. macOS 27.0.1 (Apple Silicon), local unsigned dmg `dist/creidhne-1.15.0.dmg` at `2ee9a4d`, Sabrael, 2026-11-19: pass.
- [x] **A changed Taliesin program is refused (HTOO-679).** Replace the Taliesin program that you chose with another build of it, or change one byte of a copy and choose the copy. Open in Taliesin must refuse and tell you to choose the program again in Settings. Choose it again, and Taliesin starts. Linux Mint 22.3, packaged build at `2c634fd`, Sabrael, 2026-11-19: pass. macOS 27.0.1 (Apple Silicon), local unsigned dmg `dist/creidhne-1.15.0.dmg` at `2ee9a4d`, Sabrael, 2026-11-19: pass.
- [x] **Upgrade: the world index builds again.** The first start after the upgrade builds the index of the world. Settings → World indexes lists the 1.15.0 index as old, and Remove removes it. Linux Mint 22.3, packaged build at `2c634fd`, Sabrael, 2026-11-19: pass. macOS 27.0.1: carried from the Linux pass, because it is the same code path, and not run again (Sabrael, 2026-11-19).
- [x] **Open on a script (HTOO-680).** On an NPC, a creature or a castable whose script exists in the world, click the open button (the arrow-out icon) beside the script name. With VS Code installed, VS Code opens the file. On a machine with no VS Code, or with `code` not on PATH, the default program for `.lua` opens it. No command window shows on Windows. Linux Mint 22.3, packaged build at `2c634fd`, Sabrael, 2026-11-19: pass. macOS 27.0.1 (Apple Silicon), local unsigned dmg `dist/creidhne-1.15.0.dmg` at `2ee9a4d`, Sabrael, 2026-11-19: pass.
- [x] **Pack icon dye, by eye (HTOO-695).** Set a client folder and a Brigid assets folder with an `item_icons` pack. Open an item whose Sprite is a pack icon that has the purple dye colours, and set its Color to a colour such as Crimson. The Sprite preview shows the icon in that colour. Set the Sprite to a modern id (20001 or more): that icon stays undyed with any Color. If a pack has a `no_dye` list, an id in it stays undyed. Linux Mint 22.3, packaged build at `2c634fd`, Sabrael, 2026-11-19: pass. macOS 27.0.1: carried from the Linux pass, because it is the same code path, and not run again (Sabrael, 2026-11-19).
- [x] **The item picker toggle (HTOO-695).** With a client folder and an `item_icons` pack, the item sprite picker shows Vanilla and Hybrasyl. Vanilla shows the `legend.dat` frames only. Hybrasyl adds the pack icons, and a pack icon replaces the legacy frame of the same id. Close Creidhne and start it again: the picker opens in the mode that you chose last. Linux Mint 22.3, packaged build at `2c634fd`, Sabrael, 2026-11-19: pass. macOS 27.0.1: carried from the Linux pass, because it is the same code path, and not run again (Sabrael, 2026-11-19).
- [x] **Packs in Brigid's order (HTOO-695).** With the real Brigid assets folder, an id that two packs have shows the same art in Creidhne as in Brigid. The log shows no unknown-type warning for the `ui_theme` or `ambient_sounds` packs. Linux Mint 22.3, packaged build at `2c634fd`, Sabrael, 2026-11-19: pass. macOS 27.0.1: carried from the Linux pass, because it is the same code path, and not run again (Sabrael, 2026-11-19).
- [x] **The formula file loads on the server.** Save a formula. `scripts/modules/formulas.lua` is written, and nothing is written to `scripts/formulas.lua`. A local server that runs a script with `require("formulas")` loads it. Linux Mint 22.3, packaged build at `2c634fd`, Sabrael, 2026-11-19: pass. macOS 27.0.1: carried from the Linux pass, because it is the same code path, and not run again (Sabrael, 2026-11-19).

Carried from 1.15.0, still not ticked. Do each in the eight themes; Settings → Appearance → Theme gallery shows most controls on one page (HTOO-572):

- [x] **A destructive button.** On Hybrasyl, Chadul, Danaan and Grinneal, Clear on a Settings path card and Delete in the delete confirmation of a file list show the error colour. Linux Mint 22.3, packaged build at `2c634fd`, Sabrael, 2026-11-19: pass. macOS 27.0.1: carried from the Linux pass, because it is the same code path, and not run again (Sabrael, 2026-11-19).
- [x] **A coloured chip.** The Active chip on a library and the formula category chips show their colour. Linux Mint 22.3, packaged build at `2c634fd`, Sabrael, 2026-11-19: pass. macOS 27.0.1: carried from the Linux pass, because it is the same code path, and not run again (Sabrael, 2026-11-19).
- [x] **A filled button and a hover.** A contained button changes under the pointer. Linux Mint 22.3, packaged build at `2c634fd`, Sabrael, 2026-11-19: pass. macOS 27.0.1: carried from the Linux pass, because it is the same code path, and not run again (Sabrael, 2026-11-19).

These three are theme checks, and they are done on both OS. They do not come back in a later release unless a theme changes. `e2e/theme-gallery.spec.js` covers the themes after that (Sabrael, 2026-11-19).

## Windows

Use the release build. The signing steps run only in CI.

- [ ] **Electron 45 starts from each package (HTOO-694).** Run the NSIS installer fresh, then the portable exe. Each starts, opens a world, saves a file and closes. Then install over 1.15.0 (the upgrade checks above).
- [ ] **The files are signed (HTOO-683).** Properties → Digital Signatures on the installer, the portable exe and the installed `Creidhne.exe` each show a valid signature. This is the first release with each action pinned and the signing tool checksummed, so the release workflow itself must also finish green.
- [ ] **Creidhne refuses a changed app archive on Electron 45 (HTOO-381).** Change one byte of `resources\app.asar` in the install folder, keeping a backup. Creidhne does not start. Put the original back, and it starts.
- [ ] **A portable launch finds Taliesin beside it (HTOO-667).** Put the portable Creidhne exe and a portable or unpacked Taliesin in one folder, with no Taliesin installed and no Taliesin program in Settings. Start the portable Creidhne, and Open in Taliesin starts the Taliesin beside it.
- [ ] **A portable Creidhne started by another portable app (HTOO-667).** Start the portable Taliesin, and from it open Creidhne (installed or portable). Creidhne starts, and its log shows no portable sweep error. A Taliesin that the portable Creidhne starts does not take itself for a portable launch.

## macOS

Before the tag, use a local unsigned dmg. Build it with `npm run build && CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac --universal -c.mac.notarize=false`. The `.dmg` from the release workflow comes after the tag.

- [x] **Electron 45 starts (HTOO-694).** The `.dmg` installs. Creidhne starts, opens a world, saves a file and quits with ⌘Q. macOS 27.0.1 (Apple Silicon), local unsigned dmg `dist/creidhne-1.15.0.dmg` at `2ee9a4d`, Sabrael, 2026-11-19: pass.
- [x] **No DYLD entitlement (HTOO-664).** Run `codesign -d --entitlements - /Applications/Creidhne.app`. It lists three keys and no `com.apple.security.cs.allow-dyld-environment-variables`. Creidhne still starts with the hardened runtime. If the build is not signed, write "not signed" and skip the read-back. macOS 27.0.1, Sabrael, 2026-11-19: pass on the installed signed Creidhne 1.15.0 (no `allow-dyld-environment-variables` key). The read-back on the signed dmg of this release is owed after the tag (below).
- [x] **Creidhne refuses a changed app archive.** As on Windows, with `Contents/Resources/app.asar`, but change it in a copy of the local build (`dist/mac-universal/Creidhne.app`), not in `/Applications/Creidhne.app`. macOS 27.0.1 (Apple Silicon), local unsigned dmg `dist/creidhne-1.15.0.dmg` at `2ee9a4d`, Sabrael, 2026-11-19: pass.

After the tag, with the signed `.dmg` from the release workflow:

- [ ] **No DYLD entitlement on the signed build (HTOO-664).** Install the signed `.dmg`, and run `codesign -d --entitlements - /Applications/Creidhne.app`. It lists three keys and no `com.apple.security.cs.allow-dyld-environment-variables`. Creidhne still starts with the hardened runtime.

## Linux

- [x] **Electron 45 starts from each package (HTOO-694).** Install the `.deb`, and run the AppImage. Each starts, opens a world, saves a file and closes. Linux Mint 22.3, the `.deb` and the AppImage built at `2c634fd`, Sabrael, 2026-11-19: pass.
