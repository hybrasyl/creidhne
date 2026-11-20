# WP8 — An agent interface for world data

**Card:** HTOO-705. **Size:** L. **Depends on:** —. **Status:** Planned (draft for review, 2026-11-19). **Prompted by:** Mabon's WP107 (`mabon-map`), which gave the lore map a headless CLI and an MCP server.

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

- **Lua.** `scripts/` is not in the reference table. A Lua call such as `Teleport("<map name>")` is not an anchored reference (see Open questions).
- **Edits other than names.** The interface does not set fields on an entity. An agent edits the XML, then runs `validate` and `check`. A field-level write needs each page's parse and build, and each of those is a separate design.
- **The packaged app.** `Creidhne.exe --world <command>` is not in this WP. The CLI runs from a checkout, as Mabon's does.
- **Maps.** Taliesin owns map files. `check` reports a reference to a missing map, and it does not change maps.

## Decisions (for Sabrael)

1. **Commits.** Mabon's interface makes one scoped commit for each `--write`. Creidhne's GUI does not commit, and in the world repo the agent commits on a feature branch. Recommended: **no commit**. `--write` prints the paths it changed, and the agent commits those paths. One world session staged a person's in-progress rename into the agent's commit, so a CLI that commits by itself adds that risk.
2. **How `rename` writes the entity's own `<Name>`.** (a) Through the page's parse and build, as a GUI save does. This is the parity rule, but it rewrites a hand-written file into Creidhne's format, so the first rename of a file gives a large diff. (b) A text edit of the root `<Name>` element only, as `rewriteReferences` does for referrers. Recommended: **(b)**. The referrers already use a text rewrite in the GUI, and (b) keeps the diff to one line.
3. **A shared MCP front.** Mabon has `mcp.ts`, this WP adds `mcp.js`, and the dalib-ts plan (the document repo, `plans/dalib-ts/cli-and-mcp-plan.md`) adds a third. Recommended: **make it a house module** in the template (`house-js/` and the TS edition), copied verbatim with its GENERATED header, as the title bar and the editor shell are. The alternative is three copies.
4. **The command name.** `npm run world` and MCP server `creidhne-world`. The alternative is `creidhne`.

## Open questions

- **Lua referrers.** A `--scripts` option on `refs` and `rename` could search `scripts/` as plain text and report the hits as unanchored, for a person or an agent to check. It would have found fault 3. It cannot repoint safely, so it would report only.
- **Ceridwen.** Ceridwen is a world folder, and the same commands work on it. Confirm that the agent rules for ceridwen allow the write commands.
- **Report types.** `report` covers castables and items, the two types WP3 built. Creatures, NPCs, statuses and spawngroups stay unbuilt until a report needs them.
