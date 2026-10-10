# Release testing: changes since 1.13.1

These are the manual checks the next release needs: everything in `CHANGELOG.md`
under `[Unreleased]` that the automated gate cannot see. Check off each item as it
is done, and record the build and the tester next to it.

As of `e292882`, the automated gate is green on macOS: `lint:check`, `npm test`
(2007 passed), `build`, and `e2e:only` (18 of 18). Before `npm test` on a fresh
clone, run `npm run fetch-xsd`. The XSDs are not in the repo, and 7 XSD tests fail
without them.

## Already covered by E2E

The specs below run these on every `npm run e2e`, so they need no manual pass:

- The macOS app menu, and ⌘Q with unsaved changes (`app-menu.spec.js`)
- Closing while another app is in front (`close-unfocused.spec.js`)
- The title bar on each platform (`title-bar.spec.js`)
- A loot set with many tables (`loot-tables.spec.js`)
- Every page opens without hitting the error boundary (`nav-pages.spec.js`)

## Pending: Windows

Use a packaged build from `npm run build:win` or from the release workflow. The
signing steps only run in CI.

- [ ] **The portable exe does not flash on close (HTOO-466).** Launch
      `creidhne-<version>-portable.exe`. While it unpacks you should see a busy
      cursor and no image, then the Creidhne splash. Close Creidhne. No blank Setup
      window should appear afterwards. Repeat a few times; the old flash came on
      every close.
- [ ] **The portable exe sweeps its leftover folders.** Launch the portable exe, then
      end its process in Task Manager while Creidhne is still open, so its
      `%TEMP%\ns*.tmp` folder is left behind. Note the folder's name. After 10 minutes,
      launch the portable exe again and wait 30 seconds. The old folder should be
      gone. The folder of the copy that is running must remain.
      `src/main/portableSweep.js` has the rules. A folder is removed only when it
      holds a copy of Creidhne, is more than ten minutes old, and no running copy is
      using it.
- [ ] **Creidhne refuses a changed app archive (HTOO-381).** Install a build. Change one
      byte of `resources\app.asar` in the install folder, keeping a backup. Creidhne
      should not start. Put the original file back, and Creidhne should start again.
- [ ] **The files are signed.** Open Properties → Digital Signatures on the
      installer, the portable exe and the installed `Creidhne.exe`. Each should
      show a valid signature. This is the first release signed with CodeSignTool.
- [ ] **The NSIS installer works end to end.** Install fresh, then upgrade over
      1.13.1. Settings and the world path should survive the upgrade. Uninstall
      afterwards. Run the installer once while Creidhne is open, and it should ask
      you to close it.
- [ ] **Closing from the taskbar.** With another window in front, right-click
      Creidhne in the taskbar and choose Close window. Creidhne should close, and
      with unsaved edits it should ask first. E2E covers this, but the taskbar
      click itself is only real on Windows.

## Done

These were checked on 2026-10-10.

**macOS**

- [x] ⌘-click adds a file to the selection in the file list.
- [x] ⌘1–⌘9 open the Go menu's pages, ⌘S saves and ⌘, opens Settings. Menu commands
      do nothing while a dialog is open.
- [x] The `.dmg` installs, and Creidhne refuses a changed app archive.

**Linux**

- [x] The icon is the navy-and-gold tile. Install the `.deb`, and run the
      AppImage. The launcher entry and the taskbar should both show the
      navy-and-gold tile, not the Windows star.
- [x] A smoke test of both packages. The `.deb` and the AppImage start, open a
      world, and save a file.

**Any platform**

- [x] Check for updates gives each of its three results: up to date, a newer
      version (with its link), and the reason a check failed. The notice 10 seconds
      after start appears once, and closing it hides that version.
- [x] Each picker opens in its own folder first, then the last folder you picked,
      then the active world, then Documents. None opens in Downloads.
- [x] Saving the ceridwen Mileth Crypt loot sets with no edit keeps all their
      tables. Saving a creature with loot written directly on it keeps that loot,
      and its notice shows (HTOO-522).
- [x] `a $& b` in a designer comment, an NPC location and a formula template field
      is saved as typed, and the formula editor does not freeze (HTOO-469).
- [x] Dialog export of the sequences `farewell_end` and `quest_1` writes the keys
      `s_end` and `s_1`, and the Lua parses (HTOO-498).
- [x] A formula saved with Stepped Tiers opens as None (HTOO-132).
