# CHANGELOG

## v4.0.0-beta2 – 2026-03-04

### Added

- Text iDevice: improve feedback detection with legacy compatibility (eXe 2.9)
- Classify iDevice: increase max categories from 4 to 9
- Download source file iDevice: auto-update Project Properties
- Magnifier iDevice: add image authorship and alt text field
- Visual distinction (temporary border) for Teacher Mode within the application
- Zen and Nova styles: visual distinction for Teacher Mode
- Accessibility improvement: underlined links
- File Manager: use modal dialog instead of native `window.prompt()`
- CPU compatibility check for the Bun runtime with warning for incompatible CPUs
- Clean Yjs IndexedDB on tab close
- Strings revision
- Complete Spanish translation

### Fixed

- Mixed languages on first launch
- Pixelated application icons
- Desktop no longer closes silently with unsaved changes
- Boxes missing `.box-content` within eXe
- `common_i18n.js` not generated based on the package language
- Untranslated Previous/Next navigation buttons
- TinyMCE media type selection issue
- TinyMCE deleting part of link titles
- TinyMCE not displaying the default font-family name
- iDevice button issues when TinyMCE is in full-screen mode
- Teacher Mode related issues
- Duplicated results in the search tool
- Base style: presentation issues in preview
- Zen style: gap on first Text iDevice and unnecessary empty paragraphs
- Duplicated Accessibility Toolbar files
- Accessibility Toolbar presentation issues
- Embedded PDF and document links in preview mode
- Pinned preview: style presentation issues
- Game iDevices: mobile drag-and-drop issues and small screen visibility
- Page scroll position after saving an iDevice
- File Manager preview issue in WAF-protected environments
- Race condition causing Image Optimizer to get stuck in "Queued"
- Assets exported with unknown/unknown_N filenames
- Typo in Windows build package
- Homebrew push on release
- CI/CD pipelines for forks: skip signing and external publishing when secrets are unavailable

### Upgraded

- Bun upgraded to 1.3.10
- Updated multiple dependencies and devDependencies to their latest versions, including `dotenv`, `elysia`, `fast-xml-parser`, `ioredis`, `jsdom`, `kysely`, `lib0`, `mermaid`, `mysql2`, and development tools such as `@babel/core`, `electron`, and `esbuild`

### Removed

- Double-click handler for page properties to prevent unintended modal opening
- Removed "Static Editor" from the title of the static version

---

## v4.0.0-beta1 - 2026-02-24

- First beta release of eXeLearning 4.0 ready for testing and collaboration. New backend built using Elysia, Bun, and Kysely.
