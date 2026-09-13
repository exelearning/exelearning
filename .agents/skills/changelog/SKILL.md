---
name: changelog
description: Generate a draft CHANGELOG entry for the next release from merged GitHub pull requests, or update the existing draft block with PRs merged since one already incorporated. Asks the user which mode to run before starting.
---

# Skill: Generate or update CHANGELOG draft

> **This skill produces a working draft, not a finished changelog.** The output is a starting point to make the task easier — the maintainer must review, edit and refine every entry before committing.

Two modes are available:

- **Mode A — Update existing draft** (use this most of the time, e.g. "check for new PRs since we last updated the changelog"): reviews PRs merged after a given already-incorporated PR, and appends new entries to the draft block already at the top of `public/CHANGELOG.md`.
- **Mode B — New version block**: generates a brand-new version block from all PRs merged since the last *published* GitHub release. Use this only when starting the draft for a release that has no block yet.

---

## 0. Ask which mode to run

**Before doing anything else**, ask the user:

> Do you want to (A) update the existing draft at the top of the CHANGELOG with PRs merged since one that's already in there, or (B) start a brand-new version block from the last published release?

If the user doesn't know or this is a recurring "check for new PRs" task, default to **Mode A**.

---

## Mode A — Update the existing draft

### A.1 Ask for the last incorporated PR

Ask the user:

> What's the number of the last PR that's already reflected in the current CHANGELOG draft?

Wait for the PR number (e.g. `2012`). Don't try to guess it by matching changelog text back to PR titles — it's ambiguous and error-prone; asking is more reliable.

### A.2 Get the cut-off timestamp

```
gh pr view <N> --repo exelearning/exelearning --json number,title,mergedAt
```

Record `mergedAt` as the cut-off.

### A.3 List PRs merged after the cut-off

```
gh pr list \
  --repo exelearning/exelearning \
  --state merged \
  --search "merged:>YYYY-MM-DDTHH:MM:SSZ" \
  --json number,title,body,labels,mergedAt \
  --limit 200
```

Sort by `mergedAt` ascending. For each PR, read `title` and the full `body` (the primary source — a PR title alone often hides a real fix mixed in with test changes, or vice versa).

### A.4 Filter out non-user-facing PRs

Skip PRs that only touch tests, CI, linting, or internal tooling with no behavioral change described in the body — typically titled `test(...)`, `chore(...)`, `ci(...)`. Read the body carefully: a `test(...)`-titled PR can still describe a real bug it fixed in application code (check for phrasing like "real bug", "underlying app race", "actual fix") — in that case extract just the user-facing fix as an entry and drop the test-only parts.

### A.5 Classify and write entries

Apply the same classification table and style rules as Mode B (see [B.3](#b3-classify-each-change) and [B.4](#b4-write-the-entries) above) to whatever survives the filter in A.4.

### A.6 Insert into the existing top block

Find the **first** `## vX.Y.Z...` block in `public/CHANGELOG.md` (the topmost one — this is the active draft). For each new entry:

- Insert it as a new bullet under the matching `### Added` / `### Changed` / `### Fixed` / `### Upgraded` / `### Removed` subsection of that block.
- If the subsection doesn't exist yet in the block, create it in the standard order (Added, Changed, Fixed, Upgraded, Removed).
- Do not create a new `## vX.Y.Z` block, and do not touch any block below the top one.
- Check for semantic duplicates (not just exact string matches) before adding — skip anything already effectively covered.

### A.7 Report back

Tell the user, per PR reviewed:
- Which PRs were added to the changelog and which bullet/section they landed in.
- Which PRs were skipped, and why (e.g. "test-only, no user-facing change").

Then give the same draft reminder as in [B.7](#b7-remind-the-user-this-is-a-draft) above.

---

## Mode B — New version block

### B.0 Ask for the target version

**Before doing anything else**, ask the user:

> What will the version number and type be for this release?
> Examples: `v4.0.0-rc2`, `v4.0.1`, `v4.1.0-beta1`

Wait for the answer. Use that value as-is for the heading — do not infer or calculate it from the existing CHANGELOG.

The release date is **today's date** in `yyyy-mm-dd` format.

---

### B.1 Find the latest published release on GitHub

Fetch the latest release to get the cut-off timestamp:

```
gh release view --repo exelearning/exelearning --json tagName,publishedAt
```

Record:
- **`tagName`** — the git tag of the last release (e.g. `v4.0.0-rc1`).
- **`publishedAt`** — the ISO timestamp used to filter merged PRs.

---

### B.2 Collect all merged PRs since the last release

```
gh pr list \
  --repo exelearning/exelearning \
  --state merged \
  --search "merged:>YYYY-MM-DDTHH:MM:SSZ" \
  --json number,title,body,labels,mergedAt \
  --limit 200
```

> Replace the timestamp with the `publishedAt` value from step 1.

For **each PR** read:
- **`title`** — the PR headline.
- **`body`** — the **full description**. This is the primary source; many PRs bundle several unrelated changes under a single title.
- **`labels`** — useful classification hints.

If a PR body references issues with `Closes #NNN` or `Fixes #NNN`, fetch them too:

```
gh issue view NNN --repo exelearning/exelearning --json title,body
```

---

### B.3 Classify each change

Map every individual change (one PR may yield several entries) to one of four sections:

| Section | What goes here |
|---------|----------------|
| **Added** | New features, new iDevices, new CLI commands, new UI options, new documentation |
| **Fixed** | Bug fixes, presentation corrections, performance improvements, security fixes |
| **Upgraded** | Dependency version bumps |
| **Removed** | Features, options or files that no longer exist |

**Label hints:**
- `bug` → Fixed
- `enhancement` / `feature` → Added
- `dependencies` / `deps` → Upgraded
- `breaking` / `removal` → Removed

When a PR body mixes additions and fixes, split them into separate entries under the appropriate section.

---

### B.4 Write the entries

Follow the **exact style** of the existing changelog entries in `public/CHANGELOG.md`:

### Style rules

- **One sentence per bullet.** Start with a capital letter; no trailing full stop.
- **Lead with the subject area** for component-specific entries:
  `TinyMCE: …`, `Sort iDevice: …`, `File Manager: …`, `Admin panel: …`
- Describe the **outcome for users**, not the implementation:
  - ✅ `Sort iDevice: exercises with identical cards are now correctly validated`
  - ❌ `Fixed a bug in the validation logic of SortIdevice.js`
- **Avoid technical jargon** unless already used in the existing changelog (e.g. `blob:`, `asset://`, `SCORM`).
- **Dependency upgrades:** `package-name: OLD → NEW` (lowercase, `→`, no extra words).
- **Group related items** within each section (all TinyMCE entries together, all iDevice entries together, etc.).

### What NOT to include

- Duplicate entries for the same fix.
- Multiple "Updated X translation" lines — merge into one: `Updated [Language] ([CODE]) translation`.
- Dependency-only PRs with no user-visible effect may be grouped into one bullet if there are many minor bumps.
- Merge commits and version-bump-only PRs.
- Purely internal changes (CI tweaks, test additions, linting) unless significant.

---

### B.5 Assemble the block

```markdown
## vX.Y.Z-type – YYYY-MM-DD

### Added

- …

### Fixed

- …

### Upgraded

- …

### Removed

- …

---
```

Omit any section that has no entries.

---

### B.6 Insert into `public/CHANGELOG.md`

Insert the new block **immediately after the `# CHANGELOG` heading** and before the previous version's `## v…` entry.

```
# CHANGELOG

## vX.Y.Z-type – YYYY-MM-DD      ← new draft block
…
---

## v4.0.0-rc1 – 2026-04-07       ← previous block, unchanged
…
```

Do **not** modify any existing content below the insertion point.

---

### B.7 Remind the user this is a draft

After inserting the block, tell the user:

> ⚠️ This is a draft. Please review every entry before committing:
> - Check that descriptions are accurate and clear for end users.
> - Merge or remove redundant entries.
> - Verify dependency version numbers against the actual `package.json` / `bun.lock` diff.
> - Add anything the PRs may not have described explicitly.

---

## Reference: existing entry style

```markdown
## v4.0.0-rc1 – 2026-04-07

### Added

- Teacher-only content indicator now uses an icon instead of a border for clearer visual distinction
- New admin dashboard with activity metrics and online users
- New `make translations-sort` command to reorder `<trans-unit>` elements in XLF files

### Fixed

- TinyMCE: usability and accessibility improvements across the editor
- TinyMCE media plugin: YouTube Live and Shorts URLs are now correctly recognized
- Sort iDevice: exercises with identical cards (same image, text or audio) are now correctly validated
- Link validator now returns a clear error message instead of a generic `NetworkError`

### Upgraded

- mozilla/pdf.js: 5.5.207 → 5.6.205
- typescript: 5.9.3 → 6.0.2

### Removed

- Homebrew distribution support
```
