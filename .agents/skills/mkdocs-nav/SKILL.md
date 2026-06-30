---
name: mkdocs-nav
description: Sync the mkdocs.yml nav with the actual contents of doc/. Finds every .md file under doc/, identifies which are missing from the nav, proposes a complete ordered nav, and writes it to mkdocs.yml.
---

# Skill: Sync mkdocs.yml nav

> Parent: [AGENTS.md](../../../AGENTS.md)

Keep the `nav:` section in `mkdocs.yml` in sync with the files that actually exist under `doc/`. Run this whenever a new doc is added and needs to appear on https://exelearning.github.io/exelearning/.

---

## 0. Before you start

Read these two sources in full:

1. `mkdocs.yml` — current nav and site config.
2. All `.md` files under `doc/` — use Glob with `doc/**/*.md`.

Do not skip any file. The goal is a nav that references **every** `.md` file exactly once.

---

## 1. Identify gaps

List every `.md` path returned by the glob. Normalize paths to forward slashes and strip the `doc/` prefix (MkDocs paths are relative to `docs_dir: doc`).

Compare with every path already referenced under `nav:` in `mkdocs.yml`.

Report which files are **missing** from the nav and which nav entries point to **files that no longer exist** (stale entries). Both must be fixed.

---

## 2. Assign each doc to a section

Use the table below to decide where each file belongs. When in doubt, read the first two lines of the file for its title and description.

| Path prefix / filename | Nav section |
|------------------------|-------------|
| `index.md` | Top level — always first |
| `overview.md` | Top level |
| `install.md` | Top level |
| `profile-avatars.md` | Top level (end users) |
| `deployment.md` | Top level |
| `high-availability.md` | Top level |
| `deploy/README.md` | Top level — label **"Deploy: Sample Configs"** |
| `architecture.md` | Top level — label **"Architecture"** |
| `conventions.md` | Top level — label **"Conventions"** |
| `development/*.md` | **Development** section |
| `contentv3-format.md` | **File Formats** section — label **"Legacy ELP Format"** |
| `elpx-format.md` | **File Formats** section — label **"ELPX Format"** (subsection root) |
| `elpx-format/*.md` | **File Formats › ELPX Format** subsection |
| `elpx-format/idevices/*.md` | **File Formats › ELPX Format › iDevices** sub-subsection |
| `elpx-format/examples/*.md` | **File Formats › ELPX Format › Examples** sub-subsection |

### Ordering within each section

**Top level** (in this order):
1. Home (`index.md`)
2. Overview (`overview.md`)
3. Install (`install.md`)
4. Profile Avatars (`profile-avatars.md`)
5. Deployment (`deployment.md`)
6. High Availability (`high-availability.md`)
7. Deploy: Sample Configs (`deploy/README.md`)
8. Architecture (`architecture.md`)
9. Conventions (`conventions.md`)

**Development** (alphabetical by label, except Environment first):
Environment → Version Control → Contributing → Testing → Internationalization → Real Time → Embedding → Profiling → Customization → Styles → Installers → REST API → Authentication

**File Formats** (Legacy ELP first, then ELPX):
1. Legacy ELP Format (`contentv3-format.md`)
2. ELPX Format (`elpx-format.md`) — then subsections in this order:
   - Container & XML group: Container → content.xml → IDs → Metadata → Pages & Blocks
   - iDevices subsection: Catalog → Patterns → config.xml → Snippets
   - Resources group: Themes → Libraries → Assets → Screenshot
   - Pipelines group: Tracking → Export Pipeline → Import Pipeline → Validation
   - AI Generation
   - Examples subsection: Minimal → Multi-page → Full Package Tree

If a new file appears that doesn't match any entry above, add it to the most logical section and note your choice as a comment in your response.

---

## 3. Write the updated `mkdocs.yml`

Preserve **everything outside the `nav:` block** exactly as-is (theme, plugins, markdown_extensions, extra, validation, etc.). Only replace the `nav:` block.

Use 2-space indentation inside `nav:` (MkDocs convention). Labels must be human-readable title case.

Target structure (expand as needed to include every file):

```yaml
nav:
  - Home: index.md
  - Overview: overview.md
  - Install: install.md
  - Profile Avatars: profile-avatars.md
  - Deployment: deployment.md
  - High Availability: high-availability.md
  - Deploy\: Sample Configs: deploy/README.md
  - Architecture: architecture.md
  - Conventions: conventions.md
  - Development:
      - Environment: development/environment.md
      - Version Control: development/version-control.md
      - Contributing: development/contributing.md
      - Testing: development/testing.md
      - Internationalization: development/internationalization.md
      - Real Time: development/real-time.md
      - Embedding: development/embedding.md
      - Profiling: development/profiling.md
      - Customization: development/customization.md
      - Styles: development/styles.md
      - Installers: development/installers.md
      - REST API: development/rest-api.md
      - Authentication: development/authentication.md
  - File Formats:
      - Legacy ELP Format: contentv3-format.md
      - ELPX Format:
          - Overview: elpx-format.md
          - Container: elpx-format/container.md
          - content.xml: elpx-format/content-xml.md
          - IDs: elpx-format/ids.md
          - Metadata: elpx-format/metadata.md
          - Pages & Blocks: elpx-format/pages-blocks.md
          - iDevices:
              - Catalog: elpx-format/idevices/catalog.md
              - Patterns: elpx-format/idevices/patterns.md
              - config.xml: elpx-format/idevices/config-xml.md
              - Snippets: elpx-format/idevices/snippets.md
          - Themes: elpx-format/themes.md
          - Libraries: elpx-format/libraries.md
          - Assets: elpx-format/assets.md
          - Screenshot: elpx-format/screenshot.md
          - Tracking: elpx-format/tracking-emission.md
          - Export Pipeline: elpx-format/export-pipeline.md
          - Import Pipeline: elpx-format/import-pipeline.md
          - Validation: elpx-format/validation.md
          - AI Generation: elpx-format/ai-generation.md
          - Examples:
              - Minimal content.xml: elpx-format/examples/minimal-content-xml.md
              - Multi-page content.xml: elpx-format/examples/multi-page-content-xml.md
              - Full Package Tree: elpx-format/examples/full-package-tree.md
```

> **Important:** The colon in `Deploy: Sample Configs` must be escaped as `\:` inside a YAML mapping key. Alternatively, quote the key: `"Deploy: Sample Configs"`. Either is correct YAML; prefer the quoted form for readability.

After writing the file, re-read it and confirm the YAML is valid (no duplicate keys, consistent indentation).

---

## 4. Report back

Tell the user:

1. Which files were **added** to the nav (list them).
2. Which entries were **removed** as stale (list them, if any).
3. Which files, if any, you placed in a section not listed in the table above, and why.
4. Any file you skipped and the reason (e.g., it is a `doc/style.css` or non-Markdown asset — those should never appear in the nav).

Do **not** modify any file other than `mkdocs.yml`.
