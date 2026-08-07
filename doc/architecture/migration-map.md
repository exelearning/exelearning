# Architecture record migration map

This page maps every retired architecture identifier to its current location.

Identifiers were migrated from a globally sequential counter (`ADR-NNNN`,
`SDD-NNNN`) to tracking-issue-based identifiers. The decision, the alternatives
considered and the evidence are recorded in
[ADR-2232-01](adr/ADR-2232-01-use-tracking-issue-based-architecture-identifiers.md);
the tracking issue is
[#2232](https://github.com/exelearning/exelearning/issues/2232).

**Retired identifiers must not be used in new content.** `make architecture-check`
fails when one appears outside this page and the `legacy_id` frontmatter field.
Use the tables below to find the current identifier.

## Architecture Decision Records

| Old identifier | New identifier | Tracking issue | Current path |
|---|---|---|---|
| `ADR-0001` | `ADR-2193-01` | [#2193](https://github.com/exelearning/exelearning/issues/2193) | [`adr/ADR-2193-01-runtime-specific-elpx-import-limits.md`](adr/ADR-2193-01-runtime-specific-elpx-import-limits.md) |
| `ADR-0035` | `ADR-1858-01` | [#1858](https://github.com/exelearning/exelearning/issues/1858) | [`adr/ADR-1858-01-restore-file-attachment-as-json-idevice.md`](adr/ADR-1858-01-restore-file-attachment-as-json-idevice.md) |
| `ADR-0036` | `ADR-1858-02` | [#1858](https://github.com/exelearning/exelearning/issues/1858) | [`adr/ADR-1858-02-use-asset-uri-references.md`](adr/ADR-1858-02-use-asset-uri-references.md) |
| `ADR-0037` | `ADR-1858-03` | [#1858](https://github.com/exelearning/exelearning/issues/1858) | [`adr/ADR-1858-03-remap-legacy-file-attachments.md`](adr/ADR-1858-03-remap-legacy-file-attachments.md) |
| `ADR-0038` | `ADR-1858-04` | [#1858](https://github.com/exelearning/exelearning/issues/1858) | [`adr/ADR-1858-04-fail-safe-accessible-attachment-rendering.md`](adr/ADR-1858-04-fail-safe-accessible-attachment-rendering.md) |
| `ADR-0042` | `ADR-2184-01` | [#2184](https://github.com/exelearning/exelearning/issues/2184) | [`adr/ADR-2184-01-no-generic-open-response-assessment-idevice.md`](adr/ADR-2184-01-no-generic-open-response-assessment-idevice.md) |

Slugs were rewritten where the original named the topic rather than the decision
(`ADR-0038-file-attachment-resilience-accessibility` →
`ADR-1858-04-fail-safe-accessible-attachment-rendering`). Every file kept its
content; only the frontmatter identifiers, the H1 and the duplicated `## Status`
section changed. Renames were made with `git mv`, so `git log --follow` still
resolves the full history.

The local sequence preserves the original relative order within each issue:
`ADR-0035`–`ADR-0038` became `-01` through `-04`.

## Software Design Documents

| Old identifier | Current path | Tracking issue | Notes |
|---|---|---|---|
| `SDD-0009` | [`changes/1858-file-attachment-restoration/design.md`](changes/1858-file-attachment-restoration/design.md) | [#1858](https://github.com/exelearning/exelearning/issues/1858) | Moved whole. It was already `Implemented`, so it is preserved as the historical design record rather than split across `proposal.md` / `spec.md` / `design.md`. |

Newly written changes use the full document set described in
[`changes/README.md`](changes/README.md). Existing implemented designs are not
retro-fitted into it — splitting a shipped design record would rewrite history
for no benefit.

## Templates and indexes

| Old path | Current path | Notes |
|---|---|---|
| `adr/ADR-0000-template.md` | [`adr/template.md`](adr/template.md) | `ADR-0000` is not a valid identifier under the new grammar. |
| `sdd/SDD-0000-template.md` | [`changes/template.md`](changes/template.md) | Consolidated: one template covering all five change documents. |
| `sdd/README.md` | [`changes/README.md`](changes/README.md) | Rewritten for the change-directory model. |
| `adr/records.md` | *removed* | The index is no longer committed. `make architecture-records` prints it from frontmatter. |
| `sdd/records.md` | *removed* | Same. |

The `doc/architecture/sdd/` directory no longer exists; its contents moved to
`doc/architecture/changes/`.

## Identifiers reserved on open branches

At migration time, 16 identifiers were claimed by more than one branch — `ADR-0001`
by six. Those records live on unmerged pull requests and are migrated on their own
branches, not here. Each affected PR carries its own mapping; see
[#2232](https://github.com/exelearning/exelearning/issues/2232) for the
reconciliation report.

Because the old identifiers were never unique across branches, a retired
identifier such as `ADR-0020` does **not** resolve to a single record. Only the
identifiers listed in the tables above — the ones that actually existed on the
default branch — have an unambiguous mapping.
