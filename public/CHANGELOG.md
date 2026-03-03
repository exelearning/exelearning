# CHANGELOG

## v4.0.0-beta2 – 2026-03-04

### Added

- Improve feedback detection in Text iDevice with legacy compatibility (eXe 2.9)
- Increase Classify iDevice max categories from 4 to 9
- Auto-update Project Properties in Download source file iDevice
- Magnifier iDevice: add image authorship and alt text field
- Visual distinction (temporary border) for Teacher Mode within the application
- Zen and Nova styles: visual distinction for Teacher Mode
- Use modal dialog instead of native `window.prompt()` in the File Manager
- CPU compatibility check for the Bun runtime with warning for incompatible CPUs
- Feature: clean Yjs IndexedDB on tab close
- Strings revision
- Complete Spanish translation

### Fixed

- Fix mixed languages on first launch
- Pixelated application icons
- Desktop no longer closes silently with unsaved changes
- Boxes have no `.box-content` within eXe (#1419, #1421)
- TinyMCE could not choose media type
- TinyMCE deleted part of the link titles
- TinyMCE did not display the name of the default font-family
- iDevice buttons issues when TinyMCE is in full-screen mode
- Teacher Mode issues
- Duplicated results in the search tool
- Zen Style: fix gap on first Text iDevice and remove unnecessary empty paragraphs
- Improve accessibility with underlined links
- Improve pinned preview (to review)
- Embedded PDF and document links in preview mode
- Game iDevices: fix mobile drag-and-drop issues and improve small screen visibility
- Hotfix: fix page scroll (return to correct position when saving an iDevice)
- File Manager preview issue in WAF-protected environments
- Race condition causing Image Optimizer to get stuck in "Queued"
- Assets exported with unknown/unknown_N filenames
- Typo in build package on Windows
- Fixed homebrew push on release
- Fix CI/CD pipelines for forks: skip signing and external publishing when secrets are unavailable

### Upgraded

- Upgrade to Bun 1.3.10
- Dependency updates: multiple dependencies and devDependencies updated to latest versions, including `dotenv`, `elysia`, `fast-xml-parser`, `ioredis`, `jsdom`, `kysely`, `lib0`, `mermaid`, `mysql2`, and several development tools such as `@babel/core`, `electron`, and `esbuild`

### Removed

- Double-click handler for page properties to prevent unintended modal opening

---

## v4.0.0-beta1 - 2026-02-24

- First beta release of eXeLearning 4.0 ready for testing and collaboration. New backend built using Elysia, Bun, and Kysely.
