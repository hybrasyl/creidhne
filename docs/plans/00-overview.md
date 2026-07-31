# Creidhne work packages

Numbered planning docs for larger, multi-step work — modeled on dagda's and oghma's `docs/plans/`. Small fixes and dep bumps do not need one; a WP is for work worth scoping before building.

**Rules**

- **One WP per branch.** A WP is built on its own branch cut from `main`, and its PR targets `main`. Do not stack WPs.
- **Numbered.** `docs/plans/N-<slug>.md`. Numbers are assigned in order and never reused.
- A WP doc stays here until it ships; move it under `complete/` (or mark it Shipped) once merged.
- Planning docs themselves are docs-only and may land on `main` directly; the WP's *implementation* is what gets the branch.

## Active

| WP  | Title                                   | Status  | Depends on |
| --- | --------------------------------------- | ------- | ---------- |
| 1   | Castables export cleanup (3 presets)    | Planned | —          |
| 2   | Castables report builder                | Planned | WP1        |
| 3   | Report builder for other XML types      | Planned | WP2        |
