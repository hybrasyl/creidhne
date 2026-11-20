# WP8 — An agent interface for world data

**Card:** HTOO-705. **Size:** L. **Depends on:** —. **Status:** Shipped (2026-11-19, #106). **Prompted by:** Mabon's WP107 (`mabon-map`), which gave the lore map a headless CLI and an MCP server.

## Why

Agents edit world XML in the `world` and `ceridwen` repos with grep, sed and Python heredocs. Creidhne holds the rules for that work: the declared reference table, the anchored reference scan, the server's name key, the staging release checks and the report vocabulary. An agent cannot call them, so it rebuilds them in each session, and it gets some of them wrong.

A survey of nine agent sessions in the two repos (2026-09-21 to 2026-11-07) found the counts below. The session-by-session evidence is in the document repo, `plans/creidhne/agent-interface-evidence.md`, because it names unreleased world content.

| What the agent did by hand                                                           | Count            | What Creidhne already has                |
| ------------------------------------------------------------------------------------ | ---------------- | ---------------------------------------- |
| Found the files that name an entity (`grep -rl`, `git grep`)                         | ~16              | `scanReferences`, `REFERENCE_SITES`      |
| Renamed an entity and repointed the referrers (`sed -i`, `str.replace`, Edit sweeps) | 9                | `applyRename`, `rewriteReferences`       |
| Checked names for duplicates or collisions                                           | ~6               | `nameCollisionKey`, `duplicateKeyGroups` |
| Planned a release from `.staging/`                                                   | ~7               | `releaseClashes`, `stagedOnlyReferences` |
| Checked an element table (symmetry, ids, `None`)                                     | ~8               | `elementTable.js`                        |
| Wrote a throwaway script that parses world XML                                       | ~350 (world ~97) | the parsers, `runReport`                 |

Three faults came from this:

1. **A live file names a staged-only entity.** In the production world, a `str.replace` over 26 files repointed live trainer NPCs at castable names that exist only in `.staging/`. The live castables still carry the old names. A test passed only because the same session changed the test to read the staged folder. Creidhne shows `StagedReferenceNotice` for this case. The agent had no way to see it.
2. **A text replace does not know XML.** `xargs sed -i 's/\benchant1\b/enchant/g'` in ceridwen rewrote each whole-word match. It worked that time. The anchored scan exists because `<Item Name="Lorica"/>` in an NPC is a reference and `<Item Name="Lorica">` at an item root is identity.
3. **A rename missed a referrer.** Lua scripts still teleport to two map names that renames removed, one of them in 2021. This one is outside Creidhne's reference table (see Open questions).

One session read `src/main/staging.js` and saw that it imports `referencedNames`. It then rebuilt the scan by hand, because it could not run the module.

## Goal

One headless entry, built from Creidhne's own modules and tested in this repo. An agent runs it from a shell, or calls it as MCP tools. Each command calls the function the GUI calls. A difference between the GUI and the interface is a bug.

Each command prints one line of JSON on stdout: `{ ok, command, world, result }`, or `{ ok: false, error }` with exit code 1 (2 for a usage error). `--pretty` indents it for a person.

### Read commands

| Command                                                           | What it gives                                                                                                                                                   | Core function                                                 |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `find <name> [--type T]`                                          | Each entity whose name key matches, with its type, file, and side (live, staged, archived)                                                                      | hybindex `buildIndex`, `nameCollisionKey`, `mergeStagedIndex` |
| `refs <type> <name>`                                              | The files that name the entity, live and staged, with a count for each, and the unreadable files                                                                | `scanReferences`                                              |
| `names-in <type> <file>`                                          | The entities the file names, and for each one: live, staged-only, or missing                                                                                    | `referencedNames`, `stagedOnlyReferences`                     |
| `collide <type> <name>`                                           | Whether the name collides with a live, staged or archived entity                                                                                                | `duplicateNameStatus`                                         |
| `duplicates [--type T]`                                           | The keys that more than one active file holds                                                                                                                   | `duplicateKeyGroups`                                          |
| `check [--type T]`                                                | The world's problems: a reference to a missing entity, a live file that names a staged-only entity, a duplicate key, a staged name that clashes with a live one | the functions above, `releaseClashes`                         |
| `staging [--type T]`                                              | The staged files, the live files at the same name, and the staged-only names                                                                                    | `listStaged`, `stagedKeyClash`                                |
| `report <entity> --preset <id> \| --rules <json> [--columns ...]` | Report rows for castables or items, as JSON                                                                                                                     | `runReport`, `compileDefinition`                              |
| `validate [<file> ...]`                                           | XSD validation of the files, or of each changed file in the work tree                                                                                           | `validateHybrasylXml`                                         |
| `element-table <file>`                                            | The table's problems, and whether it uses the old format                                                                                                        | `elementTable.js` validation                                  |
| `trait <file>`, `species <file>`                                  | The server's checks for a trait or a species                                                                                                                    | `validateTrait`, `validateSpecies`                            |

`check` is the command that finds fault 1. It runs the check that `StagedReferenceNotice` shows on one page, over every live file.

### Write commands

Each write command is a dry run that prints the change. `--write` writes it.

| Command                                   | What it writes                                                                                                                                                                    | Core function                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `rename <type> <old> <new>`               | The entity's `<Name>`, then every reference to it in live and staged files. It refuses a new name that collides, and it refuses an old name that more than one file claims        | the page's parse and build, `shouldOfferRepair`, `applyRename` |
| `rename <type> <old> <new> --refs-only`   | The references only, for an entity that a person renamed by hand (a variant group renamed in the GUI on 2026-10-23, then repointed in 158 items and 172 loot entries by a script) | `applyRename`                                                  |
| `stage <type> <file> ...`                 | Moves live files to `.staging/<type>/`, and names the live files that refer to them                                                                                               | `stageFiles`, `referencedNames`                                |
| `release <type> <file> ... [--with-deps]` | Moves staged files to `xml/<type>/`. It refuses a name that is already live, and `--with-deps` brings the staged-only entities that the files name                                | `releaseFiles`, `releaseClashes`, `stagedOnlyReferences`       |

A write to a file that is open in Creidhne is a change on disk. The page reloads it or asks, as it does for any outside edit.

## Design

- **The core:** `src/main/worldAgent/`. `context.js` resolves the world root and builds or loads the index. `commands.js` has one function for each command. It imports `src/shared/` and the Electron-free modules of `src/main/` (`entityRefScan.js`, `entityRefRepair.js`, `staging.js`, `reportRun.js`, the `*Xml.js` parsers). It must not import `electron`. `indexService.js` imports Electron, so the core calls hybindex-ts `buildIndex` and `buildSection` directly.
- **The world root:** `--root`, else the git work tree of the folder npm was run from (`INIT_CWD`). The root must hold `xml/`. Each write path goes through a guard that resolves the real path and refuses a path outside the root. The CLI does not read `grants.json`. That authority model protects main from the renderer, and an agent with a shell is not that threat.
- **The index:** the CLI uses the same cache as the GUI (`%LOCALAPPDATA%\Erisco\hybindex`) and the same incremental build. Each write refreshes the sections it wrote, as HTOO-372 requires of the GUI.
- **The CLI:** `cli.js`, run as `npm run -s world -- <command>`. From a world checkout: `npm --prefix <path-to-creidhne> run -s world -- <command>`.
- **The build:** `scripts/world.mjs` bundles `src/main/worldAgent/bin.js` with esbuild on each run, as Mabon's `scripts/map.mjs` does, so the CLI never runs a stale build. Creidhne's `src/` is ES modules in a package with no `"type": "module"`, so Node cannot run it without a bundle. esbuild becomes a direct `devDependency`, at the version Vite already installs.
- **The MCP front:** `mcp.js`, started as `node <path-to-creidhne>/scripts/world.mjs mcp --root <world>`. Newline-delimited JSON-RPC 2.0, tools only, with no dependency. Each tool builds the CLI's argv and calls `run`, so the two fronts give the same result. It checks a call's arguments against the tool's schema before it builds the argv, and it refuses a wrong type or a text that starts with `--` (Mabon's HTOO-702). To add it to Claude Code: `claude mcp add creidhne-world -- node <path-to-creidhne>/scripts/world.mjs mcp --root <path-to-world>`.
- **The XSD validator** moves from `src/main/__tests__/xsdValidator.js` to `src/main/xsdValidator.js`. That is step 1 of WP7, done here. `xmllint-wasm` stays a devDependency, because the CLI runs from a checkout. `validate` needs `npm run fetch-xsd`, and it reports WP7's known drift types as warnings, not errors.

## Tests

- `src/main/worldAgent/__tests__/worldAgent.test.js`, on a small world in a temporary git repo in `tmpdir`: the argument parser, the root default, each read command, each write command as a dry run and with `--write`, the refusals, and the MCP front on its own and on streams.
- **The acceptance case is fault 1.** A live NPC names a castable that exists only in `.staging/`. `check` reports it, `names-in` marks it staged-only, and `release --with-deps` of the NPC's castable brings it along.
- **The anchoring case.** A rename of item `Lorica` changes `<Item Name="Lorica"/>` in an NPC and does not change the root of a second item whose file also holds the text `Lorica`.
- **Parity.** For one rename, the files that `--write` changes are byte for byte the files that the GUI's `refs:apply` changes on the same world.
- **A source guard.** `src/main/worldAgent/` imports no `electron`, and the bundle's `require` list holds no `electron`. The guard asserts that it found the files it checks.
- **Run it on the real world.** `check` on the production world branch that holds fault 1 reports the trainer NPCs it names (the evidence doc gives the branch and the names).

## Non-goals

- **Repointing Lua.** `scripts/` is not in the reference table. A Lua call such as `Teleport("<map name>")` is not an anchored reference, so `--scripts` reports it and does not change it (decision 5).
- **Edits other than names.** The interface does not set fields on an entity. An agent edits the XML, then runs `validate` and `check`. A field-level write needs each page's parse and build, and each of those is a separate design.
- **The packaged app.** `Creidhne.exe --world <command>` is not in this WP. The CLI runs from a checkout, as Mabon's does.
- **Maps.** Taliesin owns map files. `check` reports a reference to a missing map, and it does not change maps.

## Decisions (Fintan, 2026-11-19)

Made at scoping, from the evidence. Sabrael can overrule any of them before the build.

1. **`--write` does not commit.** It prints the paths it changed, and the agent commits those paths under the repo's own rules. Creidhne's GUI does not commit, and one world session swept a person's in-progress rename into the agent's commit. Mabon commits because its GUI does; Creidhne's does not.
2. **`rename` changes the entity's own `<Name>` with a text edit of the root element**, anchored as `rewriteReferences` is for referrers. A re-save through the page's parse and build rewrites a hand-written file into Creidhne's format, so a one-word rename would give a whole-file diff. The referrers already take a text rewrite in the GUI, so the rename stays in one family.
3. **The MCP front becomes a house module** in the template, in a TS and a JS edition, copied verbatim with a GENERATED header, as the title bar and the editor shell are. It starts from Mabon's `mcp.ts`, the one that exists. The first of WP8 and the dalib-ts CLI to be built extracts it, and Mabon adopts the copy. Three hand copies of a JSON-RPC loop and an argument check (HTOO-702) would drift.
4. **The names are `npm run world` and MCP server `creidhne-world`**, to match `mabon-map`.
5. **`refs` and `rename` take `--scripts`.** It searches `scripts/` as plain text and reports the hits as unanchored. It never repoints a Lua file. It would have found fault 3.
6. **Ceridwen needs nothing extra.** The commands take any world folder, and the repo's own agent rules govern the commits and the PRs.
7. **`report` covers castables and items**, the two types WP3 built. A further type is a registry row when a report needs it.

## Outcome

Built on `wp8-world-agent`, 2026-11-19.

- **The core:** `src/main/worldAgent/`: `context.js` (the world, the write guard, the two indexes, built on first use), `commands.js` (one function for each command), `entityName.js` (the name rule for `rename`), `cli.js`, `mcp.js` and `bin.js`. Every command in the Goal is built, with the names, flags and refusals the Goal gives.
- **The MCP front** is the agent-mcp v1 house module, `src/main/agentMcp/agentMcp.js`, copied verbatim from the template's `house-js/` (hyb-electron-template PR #2). `mcp.js` holds only the tools and the spec. Add it with `claude mcp add creidhne-world -- node <path-to-creidhne>/scripts/world.mjs mcp --root <path-to-world>`.
- **The name rule:** hybindex-ts does not export its map, so `entityName.js` restates it: ten types named by a root attribute (`Name`, `Key` for species, `Locale` for localizations), six by the first `<Name>` element. An element table or a server config with no `Name` attribute is named `default`, and `rename` refuses it, because there is no attribute to edit. `entityName.test.js` builds an index over one fixture of each type and checks that the two agree, before and after a rename.
- **The build:** Vite 8 bundles with rolldown, so Creidhne had no esbuild. It is now a direct devDependency at `^0.28.2`, Mabon's version; `allowScripts` already approved it. Audit unchanged: 6 moderate (dev only), `--omit=dev` 0.
- **The XSD validator** is `src/main/xsdValidator.js`. `KNOWN_DRIFT` moved with it, so the tests and `validate` read one list. It finds `xsd/` through `CREIDHNE_REPO`, which `scripts/world.mjs` sets, so the MCP server finds the checkout's schemas from any folder. A world element table in the old format is reported as drift.
- **Tests:** `worldAgent.test.js` (31 tests) on a small world in a temporary git repo, with the index cache in a temp folder (`HYBINDEX_CACHE_DIR`), and `entityName.test.js` (20). The acceptance case fails when staged-only detection is removed (checked), and the bundle guard builds `bin.js` and fails on any `electron` require.
- **On the production world** (the branch that holds fault 1, 2026-11-19): a cold `check` takes 23 s (the first index build), a warm one 2.3 s, and `find` or `refs` under 1 s. `check` reports 559 references from live files to staged-only entities, among them the trainer NPCs of fault 1, plus 1142 missing references (841 of them NPC vend items), 1 duplicate key and 151 staged files whose name is already live. A dry-run rename of a live castable to the name of a staged one refuses. The evidence doc in the document repo has the names.
- **Not done:** the parity test against the GUI's `refs:apply` (both call `applyRename` with the same arguments, so it would compare a function with itself); the Lua search does not change Lua.
