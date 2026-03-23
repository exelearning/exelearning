# CHANGELOG

## v4.0.0-beta3 – 2026-03-23

### Added

- Games iDevices: native audio recording in the editor using the device microphone
- Complete iDevice: support for symbol answers (`<`, `>`, `=`)
- GeoGebra Activity iDevice: options to display title and author
- Maintenance mode: manage server maintenance state from the admin UI or CLI (`maintenance on/off/status`)
- Reduced dependencies and simplified script execution in development environments using Bun parallel scripts
- Makefile: warning when using a non-Bash shell on Windows (cmd/PowerShell)
- New repository-specific instruction system for AI coding agents working on eXeLearning
- Strings cleanup and revision
- Updated Catalan (CA), Galician (GL) and Spanish (ES) translations
- Added automated placeholder translations for incomplete translations

### Fixed

- Box titles were always displayed in dark color instead of adapting to the selected style
- Cross-page and same-page anchor links
- ABC music notation viewer presentation issues
- TinyMCE link plugin: unnecessary `id` attribute added to all links
- TinyMCE link plugin: "Include File Information" option did not retrieve file size and extension
- Table center alignment not applied in the "Nova" style
- prettyPhoto (`a[rel^='lightbox']`) issues with iframe, audio, and video
- Base style: document height in iframe increased unexpectedly
- Base style: iDevices with titles had no background color in edit mode
- Missing Accessibility Toolbar in projects without iDevices
- Incorrect icon colors in the Utilities menu
- License strings not translated in properties and export
- Download Source File iDevice: `.elpx` download broken in SCORM 1.2, SCORM 2004, and IMS Content Package exports
- Download Source File iDevice: compatibility with all available licenses
- Download Source File iDevice: URL updated to HTTPS
- Hidden Image iDevice: hide delay setting not applied at runtime
- Text iDevice: extra `exe-text` wrapper in exported content causing duplicate markup
- Collaborative editing: preserve active editor when a remote iDevice is created on the same page
- Collaborative editing: non-owners could delete shared projects
- File Manager: "Oldest first" / "Newest first" date sorting not working
- Theme downloads for styles installed from the admin panel returned 404
- Preview panel: file downloads lost original filename
- Untranslated strings in static bundle UI
- File > New / Open / Import flow in static mode and in the desktop app
- Fixed Electron save dialog fallback and remembered last selected filename
- Reduced peak memory usage during save, preview, and website export for large projects
- Downloaded files were sometimes saved with the wrong extension
- Fixed `.elpx` download issues in SCORM and IMS exports
- `make clean-local` command EBUSY error
- `make run-app` workflow: installed missing Electron libraries required at runtime
- Application crash on Chrome versions older than 105
- Excluded jsdom and its full dependency tree from the bundle
- Fixed Homebrew cask publish job
- CI/CD pipelines for forks: skip signing and external publishing when secrets are unavailable

### Upgraded

- electron: 40.8.0 → 41.0.0
- jsdom: 28.1.0 → 29.0.0
- vite: 7.3.1 → 8.0.0
- docker/build-push-action: 6 → 7
- docker/metadata-action: 5 → 6
- docker/setup-buildx-action: 3 → 4

### Removed

- open-cli-tools/concurrently dependency

---

## v4.0.0-beta2 – 2026-03-10

### Added

- Text iDevice: improve feedback detection with legacy compatibility (eXe 2.9)
- Classify iDevice: increase max categories from 4 to 9
- Download source file iDevice: auto-update Project Properties
- Magnifier iDevice: add image authorship and alt text
- Progress report iDevice: improve mobile responsiveness
- Scrambled list iDevice: add configurable number of attempts
- Use eXe modal instead of system `alert` for success messages when adding AI questions
- Visual distinction (temporary border) for Teacher Mode within the application
- Visual indicators for pages, boxes and iDevices that will not be visible in the export
- Zen and Nova styles: visual distinction for Teacher Mode
- Accessibility: underline links
- File Manager: use modal dialog instead of native `window.prompt()`
- CPU compatibility check for the Bun runtime with warning for incompatible CPUs
- Clean Yjs IndexedDB on tab close
- Known Issues documentation file
- Admin panel customization options: app title, favicon, head HTML, and assets
- Add `make translations-cleanup` command to remove obsolete translation strings
- Strings revision
- Complete translations: Galician (GL), Italian (IT), Spanish (ES), Romanian (RO) and Valencian (VA)

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
- `make translations` command not extracting some strings
- `make run-app` workflow: install missing Electron libraries to fix runtime errors
- Optimize asset check to use a single bulk database query
- Constraint error in PostgreSQL when syncing builtin themes
- MySQL/MariaDB syntax error in theme upsert
- Browser versions: use full reloads for online project transitions to avoid state collisions
- Desktop versions: make Save always prompt in Electron and reuse the last chosen filename
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
