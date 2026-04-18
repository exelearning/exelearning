---
name: changelog
description: Generate a draft CHANGELOG entry for the next release from merged GitHub pull requests. Asks the user for the target version before starting.
---

# Skill: Generate CHANGELOG draft

> **This skill produces a working draft, not a finished changelog.** The output is a starting point to make the task easier — the maintainer must review, edit and refine every entry before committing.

Generate a draft entry for `public/CHANGELOG.md` based on the pull requests merged since the last published release, then insert it at the top of the file.

---

## 0. Ask for the target version

**Before doing anything else**, ask the user:

> What will the version number and type be for this release?
> Examples: `v4.0.0-rc2`, `v4.0.1`, `v4.1.0-beta1`

Wait for the answer. Use that value as-is for the heading — do not infer or calculate it from the existing CHANGELOG.

The release date is **today's date** in `yyyy-mm-dd` format.

---

## 1. Find the latest published release on GitHub

Fetch the latest release to get the cut-off timestamp:

```
gh release view --repo exelearning/exelearning --json tagName,publishedAt
```

Record:
- **`tagName`** — the git tag of the last release (e.g. `v4.0.0-rc1`).
- **`publishedAt`** — the ISO timestamp used to filter merged PRs.

---

## 2. Collect all merged PRs since the last release

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

## 3. Classify each change

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

## 4. Write the entries

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

## 5. Assemble the block

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

## 6. Insert into `public/CHANGELOG.md`

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

## 7. Remind the user this is a draft

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
