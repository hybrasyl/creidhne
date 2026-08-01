# Creidhne work packages

Numbered planning docs for larger, multi-step work. Small fixes and dep bumps do not need one; a WP
is for work worth scoping before building.

The house standard is the document repo's `docs/architecture/design-docs.md` (Tier 2) — read it for
what a WP doc contains and why. **dagda's `docs/plans/` is the reference implementation**; creidhne
follows it. (An earlier version of this file credited oghma as a second model — oghma has no WP
system, only two hygiene docs. Corrected 2026-07-31.)

**Rules**

- **One WP per branch.** A WP is built on its own branch cut from `main`, and its PR targets `main`.
  Do not stack WPs. If two items would sensibly share a branch, they are one WP; if a WP would need
  several PRs, it is several WPs.
- **Numbered `NN-slug.md`,** zero-padded to two digits. Numbers are assigned in order, never reused,
  and may have gaps — they are stable ids referenced as dependencies, not a build order.
- **Shipped WP docs move to `complete/`.** In-progress and planned stay at the top level. This file
  and `00a-backlog.md` stay put.
- **`00a-backlog.md` is the deferral register** — work owed to another repo, and items parked behind
  a named trigger. A parked item may hold a WP number; a number is not a commitment.
- Planning docs are docs-only and may land on `main` directly; the WP's _implementation_ is what gets
  the branch.

## Active

| WP  | Title                                   | Size | Status           | Depends on |
| --- | --------------------------------------- | ---- | ---------------- | ---------- |
| 2   | Castables report builder                | L    | Planned          | WP1        |
| 3   | Report builder for other XML types      | L    | Planned          | WP2        |
| 4   | Weapons tab and creature attack revamp  | L    | Planned          | —          |
| 6   | Spawngroup spellbook references         | M    | Planned          | —          |
| 7   | XSD validation at the IPC save boundary | L    | Planned, blocked | —          |

## Complete

| WP  | Title                                       | Shipped    | Doc                                         |
| --- | ------------------------------------------- | ---------- | ------------------------------------------- |
| 1   | Castables export cleanup (3 presets)        | 2026-08-01 | `complete/01-castables-export-cleanup.md`   |
| 5   | `EditorFileListPanel` secondary render prop | 2026-08-01 | `complete/05-file-list-render-secondary.md` |

**WP2 is the one to take next.** WP1 unblocked it and was built for it: the canonical record,
serializers and presets in `src/shared/` are all preset-agnostic, so the report builder consumes them
directly rather than re-deriving anything. WP1's doc also records four output changes agreed during
the build and five findings outside its scope.

**WP5 shipped after the 1.10.0 tag, so it is not in that release.** Its entry sits under
`[Unreleased]` in `CHANGELOG.md` and goes out with the next version.

**WP7 is blocked** on the seven `hybrasyl/xml` XSD drift fixes, not on creidhne work. WP4 has a
prerequisite in `@eriscorp/hybindex-ts`. Both are recorded in `00a-backlog.md` under _Owed to another
repo_, so the blockers are visible from one place.

WP4, WP6 and WP7 each carry an **open question that is not creidhne's to answer** — respectively
whether the server supports multiple creature attacks, whether the spawn server expands a spellbook
by name, and whether to patch the XSDs locally. Resolve those before designing, not during.

## Where the WPs came from

WP1–WP3 were scoped from the castables export work. WP4–WP7 were promoted on 2026-07-31 from the two
prose docs that had been accumulating deferred work outside this directory:

- `docs/future-ideas.md` → **WP4, WP5, WP6**. The file is retired; `00a-backlog.md` replaces it.
- `docs/xsd-validation.md`, "Why we don't validate XML on save (yet)" → **WP7**. The rest of that doc
  is reference (quick start, reading an error, the drift catalog) and stays where it is.

`docs/xsd-validation-tier2-report.md` stays as a historical report — its finding is that the work is
already done, so there is no WP in it.

**Promotion found that three claims in those docs were wrong**, and each correction is written into
the WP that inherited it rather than only here: the XSD validator is **not** "already wired up"
(WP7), `EditorFileListPanel` has **15** consumers rather than 13 (WP5), and spawngroups have **no**
castables field to convert into a reference (WP6). A deferred note ages; re-verify it against the
code before you build it.
