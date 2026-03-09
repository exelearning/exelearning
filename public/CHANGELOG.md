# CHANGELOG

## v4.0.0-beta2 – 2026-03-10

### Added

- Text iDevice: improve feedback detection with legacy compatibility (eXe 2.9)
- Classify iDevice: increase max categories from 4 to 9
- Download source file iDevice: auto-update Project Properties
- Magnifier iDevice: add image authorship and alt text field
- Progress report iDevice: improve mobile responsiveness
- Scrambled list iDevice: add configurable number of attempts
- Visual distinction (temporary border) for Teacher Mode within the application
- Zen and Nova styles: visual distinction for Teacher Mode
- Accessibility improvement: underlined links
- File Manager: use modal dialog instead of native `window.prompt()`
- CPU compatibility check for the Bun runtime with warning for incompatible CPUs
- Clean Yjs IndexedDB on tab close
- Known Issues documentation file
- Admin panel customization options: app title, favicon, head HTML, and assets
- Strings revision
- Complete translations: Italian (IT), Spanish (ES), Romanian (RO), and Valencian (VA)

### Fixed

- Mixed languages on first launch
- File > New / Open / Import flow: fix issues in static mode and desktop app
- Pixelated application icons
- Desktop no longer closes silently with unsaved changes
- Boxes missing `.box-content` within eXe
- `common_i18n.js` not generated based on the package language
- Caps Lock key no longer triggers multi-selection
- Untranslated page counter
- Untranslated Previous/Next navigation buttons
- TinyMCE media type selection issue
- TinyMCE deleting part of link titles
- TinyMCE not displaying the default font-family name
- iDevice button issues when TinyMCE is in full-screen mode
- Teacher Mode related issues
- Duplicated results in the search tool
- Style icons: fix inconsistencies in file names
- Base style: presentation issues in preview
- Zen style: gap on first Text iDevice and unnecessary empty paragraphs
- Duplicated Accessibility Toolbar files
- Accessibility Toolbar presentation issues
- Embedded PDF and document links in preview mode
- Pinned preview: style presentation issues
- Preview in new window stopping after ~1 minute (Service Worker content loss)
- Game iDevices: mobile drag-and-drop issues and small screen visibility
- Progress report iDevice: data refresh and page order sync
- Select Media and Sort iDevices: media selection issues in cloned cards
- Page scroll position after saving an iDevice
- File Manager preview issue in WAF-protected environments
- Race condition causing Image Optimizer to get stuck in "Queued"
- Traversal vulnerability (Zip Slip) in the ZIP extraction logic
- Assets exported with unknown/unknown_N filenames
- `make run-app` workflow: install missing Electron libraries to fix runtime errors
- Optimize asset check to use a single bulk database query
- Constraint error in PostgreSQL when syncing builtin themes
- MySQL/MariaDB syntax error in theme upsert
- Browser versions: use full reloads for online project transitions to avoid state collisions
- Desktop versions: make Save always prompt in Electron and remove remembered-path overwrites
- Typo in Windows build package
- Homebrew push on release
- CI/CD pipelines for forks: skip signing and external publishing when secrets are unavailable

### Upgraded

- Bun upgraded to 1.3.10
- Updated multiple dependencies and devDependencies to their latest versions, including `dotenv`, `elysia`, `fast-xml-parser`, `ioredis`, `jsdom`, `kysely`, `lib0`, `mermaid`, `mysql2`, and development tools such as `@babel/core`, `electron`, and `esbuild`
- actions/download-artifact: 6 → 8
- actions/upload-artifact: 4 → 7
- docker/login-action: 3 → 4

### Removed

- Double-click handler for page properties to prevent unintended modal opening
- "Static Editor" removed from the title of the static version

---

## v4.0.0-beta1 - 2026-02-24

- First beta release of eXeLearning 4.0 ready for testing and collaboration. New backend built using Elysia, Bun, and Kysely.
