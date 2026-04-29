# CHANGELOG

## v4.0.0 – 2026-04-29

eXeLearning 4.0 is a complete rebuild of the application. Every part of the stack has been rethought, from the server runtime to the collaboration engine, the distribution model and the user interface. The following summarises the most significant changes since version 3.

### New technology stack

The server has been rewritten from scratch, moving from **PHP/Symfony/Mercure** to **Bun** (fast JavaScript/TypeScript runtime), **Elysia** (lightweight HTTP framework) and **Kysely** (type-safe SQL query builder). The result is a faster server with lower memory usage, improved concurrency under load and a significantly simpler codebase.

### Three ways to use eXeLearning

- **Team Edition**: server installation, full online editor with real-time collaboration, user management, persistent project storage and database-backed persistence
- **Personal Edition**: online, fully functional static Progressive Web App (PWA) that runs entirely in the browser
- **Desktop**: local installation on device, native applications for Linux, Windows and macOS, built with Electron

### New admin panel

A new admin panel provides real-time visibility into the application, including activity metrics, active users, maintenance mode control and customisation options (application title, favicon, custom head HTML, and assets). This functionality was not available in version 3.

### Collaborative editing

The Yjs-based collaborative engine has been substantially improved. Multiple synchronisation and concurrency issues from version 3 have been resolved, including shared project deletion by non-owners, editor state loss on remote changes and block reorder inconsistencies. Collaborative sessions are now more reliable and consistent.

### File Manager

The File Manager has been improved in both usability and functionality. New features include file search, sorting options and a reference counter that shows where each asset is used within a project.

### LMS and platform integration

Compatibility with the latest Moodle plugins has been improved. The editor can be embedded in platforms such as WordPress, Moodle, Omeka-S or Drupal using iframe and postMessage, with a well-defined integration API. Host platforms can inject admin-approved custom styles, override themes or block style imports without rebuilding the editor bundle.

### iDevices

Significant improvements across multiple iDevices:

- **Rubric**: PDF export, CSV import/export and SCORM score support
- **Games**: native audio recording using the device microphone
- **Classify**: maximum number of categories increased from 4 to 9
- **Sort**: correct validation of exercises with identical cards
- **Scrambled List**: configurable number of attempts
- **Case Study**: separate labels for shown/hidden feedback states
- **GeoGebra Activity**: options to display title and author
- **DigCompEdu**: new iDevice for digital competence assessment
- All iDevices now include a link to the online usage manual within the editing interface

### Interface, accessibility and exports

- Project thumbnails (`screenshot.png`) are automatically generated on each save and included in `.elpx` archives
- Accessibility improvements in exported content, including proper heading structure, a skip navigation link and correct `<title>` elements per page
- Improved responsive layout: modals, preview panel and navigation menus adapt to low-resolution screens
- Teacher Mode: teacher-only content now includes a visual indicator in the editor
- Pages, boxes and iDevices excluded from export are now visually marked in the work area; related presentation and functionality issues have been resolved
- Export metadata has been improved: `content.xml` now records the actual eXeLearning version, and license information has been standardised

### Performance and reliability

Peak memory usage during save, preview and export has been significantly reduced, particularly in large projects. Asset persistence is now more robust and reliable across different environments.

### Deployment

Deployment of the Team Edition has been simplified. Configuration options have been streamlined, and documentation covering installation, environment variables and upgrade procedures has been improved.

### Internationalization

All languages have been reviewed. Languages with complete translations: **es, eu, ca, va, gl, ro, it, pt**. All other supported languages include automated placeholder translations to ensure full interface coverage.

---

## v4.0.0-rc3 – 2026-04-27

### Added

- Themes: host integrations (WordPress, Moodle, Omeka-S) can now inject admin-approved custom styles, hide built-in styles, block automatic style imports and define a fallback theme via a `themeRegistryOverride` hook without rebuilding the editor bundle
- iDevices: a link to the online usage manual is now displayed in each iDevice editing interface

### Fixed

- Assets now persist correctly when eXeLearning is served over plain HTTP on externally accessible hosts (non-loopback environments); IndexedDB is used as fallback when the Cache API is unavailable in non-secure contexts
- Auth: `AUTH_CREATE_USERS` setting is now enforced in CAS and OpenID Connect SSO flows, returning 401 when automatic user creation is disabled
- Translation extraction mechanism now correctly generates valid XML XLF language files
- Themes: the "Imported styles" tab is hidden when theme imports are blocked by admin configuration
- Preview panel no longer overflows on screens below 992px width
- User dropdown menu shows only essential actions on mobile devices
- About, Preferences, Open file and File Manager modals now use responsive layout on mobile devices
- iDevices: edition messages now use Bootstrap dismissible alerts
- iDevices: the save dialog no longer appears twice when exporting questions in the desktop application
- iDevices: AI prompt examples preserve line breaks correctly
- iDevices: strings containing `%` are now correctly translated

### Upgraded

- uuid: 13.0.0 → 14.0.0

---

## v4.0.0-rc2 – 2026-04-22

### Added

- Projects now automatically generate a `screenshot.png` thumbnail on each save; included in `.elpx` archives and manageable from Project Properties
- Admin panel link added to the user dropdown menu for admin users
- Case Study iDevice: feedback button now supports separate labels for shown/hidden states using `Show|Hide` syntax (aligned with Text iDevice)
- Download Source File iDevice: progress bar displayed while preparing the file
- Rubric iDevice: add SCORM score support
- File Manager: single-file uploads now automatically select the uploaded file
- New `make translations-format` command to add `CDATA` tags where needed and normalize indentation in translation files
- Updated Galician (GL), Italian (IT), Romanian (RO), Basque (EU) and Valencian (VA) translations

### Fixed

- Exports no longer produce missing images when cached asset blobs are evicted under storage pressure
- Exported pages now include "Page title | Project title" in the `<title>` element for non-index pages
- Standardized license naming and reviewed license HTML rendering in exports
- Prevented machine-translated placeholder `~` from being included in exported HTML
- Rubric iDevice: resolved UI and accessibility issues
- Several iDevices: fixed LaTeX rendering issues
- TinyMCE: images no longer appear broken after paste or drag-and-drop uploads
- Workarea: content box minimize/restore arrows order corrected
- File Manager: asset reference count now updates correctly after deleting an image without reopening the project
- Export Page, Export Box and Export iDevice now correctly write files in the desktop app
- Block reorder arrows now move to the correct position in collaborative sessions
- Share modal: confirmation dialogs now use the application UI instead of the browser native dialog
- Static bundle: allow `?url=` imports without `.elpx`, `.elp`, or `.zip` file extension in pathname
- Desktop app: first save filename and last accessed folder are now preserved for subsequent saves in the same session
- Auto-updater now activates correctly on official beta and RC builds
- LMS integration: base64-encoded ELP resources sent via Moodle LTI are now correctly loaded on launch
- LMS integration: standalone controls (New, Open, Share, Save) are now hidden when running inside an LMS

### Upgraded

- @codecov/bundle-analyzer: 1.9.1 → 2.0.1
- actions/github-script: 8 → 9
- actions/upload-pages-artifact: 4 → 5
- esbuild: 0.27.7 → 0.28.0

---

## v4.0.0-rc1 – 2026-04-07

### Added

- Teacher-only content indicator now uses an icon instead of a border for clearer visual distinction
- Improved accessibility in exported content, including proper heading structure and a skip navigation link
- Prevent exposure of `blob:` URLs to users; `asset://` is now the only user-visible and persisted asset reference
- Updated Rubric iDevice: improved interface and added PDF download support and CSV import/export functionality
- Support for the `?url=` query parameter to open remote files in the static editor
- New admin dashboard with activity metrics and online users
- New `make translations-sort` command to reorder `<trans-unit>` elements in XLF files to match the order in `messages.en.xlf`
- Updated development documentation for the Translation System
- Updated Spanish (ES) translation
- Added automated placeholder translations for incomplete translations
- Full review of automated placeholder translations

### Fixed

- TinyMCE: usability and accessibility improvements across the editor
- TinyMCE media plugin: YouTube Live and Shorts URLs are now correctly recognized
- TinyMCE: toolbar visibility is now preserved between editing sessions in the desktop app
- TinyMCE: missing CSS classes in the "Insert/Edit Attributes" selector
- Added warning when pasting content containing temporary `blob:` file references that will not work in other contexts
- Link validator now returns a clear error message instead of a generic `NetworkError`
- Checklist and Progress Report iDevices: fixed double save dialog and improved PDF/PNG output quality
- Sort iDevice: exercises with identical cards (same image, text or audio) are now correctly validated
- Definition lists inside animation effects now render correctly in the desktop version
- Legacy `.elp` internal links now work correctly in the workarea editor
- Platform name string incorrectly displayed in the online version
- Unsaved changes warning is now displayed in the application's language
- Link validation detects mixed-content (HTTP on HTTPS) requests and return a clear error message instead of a generic NetworkError
- Improved "User not found" error message with more helpful context
- "Made with eXeLearning" link and page counter preferences are now respected in exports
- Further reduction of peak memory usage during save, preview and export for large projects
- Universal style: updated information, removed unused font files and restored the "Made with eXeLearning" logo
- Incorrect cursor when "Allows to minimize/display content" option is disabled in box properties
- Admin panel presentation issues
- Minor presentation issues in the workarea

### Upgraded

- codecov/codecov-action: 5 → 6
- mozilla/pdf.js: 5.5.207 → 5.6.205
- typescript: 5.9.3 → 6.0.2
- xmldom/xmldom: 0.8.12 → 0.9.9

### Removed

- Homebrew distribution support

---

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
