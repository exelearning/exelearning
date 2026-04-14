# Translation System

## Overview

eXeLearning uses XLF (XLIFF) files for internationalization. Translation files are stored in the `translations/` directory and loaded at server startup.

## Supported Languages

The application supports these interface languages:

| Code | Language |
|------|----------|
| `en` | English (default) |
| `es` | Español |
| `ca` | Català |
| `va` | Valencià |
| `eu` | Euskara |
| `gl` | Galego |
| `pt` | Português |
| `eo` | Esperanto |
| `ro` | Română |

Additional locales are available for exported content packages (see `src/services/translation.ts` for the full list).

## Translation Files

Translations are stored as XLF files in `translations/`:

```
translations/
├── messages.en.xlf
├── messages.es.xlf
├── messages.ca.xlf
├── messages.eu.xlf
├── messages.gl.xlf
├── messages.pt.xlf
├── messages.eo.xlf
├── messages.ro.xlf
└── messages.va.xlf
```

## Using Translations

### In TypeScript (Backend)

```typescript
import { trans } from '../services/translation';

// Simple translation
const message = trans('welcome.message');

// With parameters
const greeting = trans('hello.user', { name: 'John' });
// Parameters support both %param% and {param} formats
```

### In Nunjucks Templates

```njk
{{ trans('page.title') }}
{{ trans('welcome.user', { name: user.name }) }}
```

### In JavaScript (Frontend)

```javascript
// GUI translations (workarea UI strings)
const label = _('Export page');

// Content translations (iDevice content strings)
const text = c_('Page title');

// Template literals are also supported
const html = `<span>${_('Save')}</span>`;
```

## Translation Commands

### Extract New Translation Keys

Scan source files for translation function calls and add new keys to XLF files:

```bash
# Extract keys for all locales
make translations

# Extract for a specific locale
make translations LOCALE=es

# Only extract (no cleanup) — equivalent to make translations
bun cli translations --extract-only
```

### Clean and Remove Obsolete Keys

Remove entries that no longer exist in the source code (destructive — irreversible without git):

```bash
# Clean all locales
make translations-cleanup

# Clean a specific locale
make translations-cleanup LOCALE=es

# Equivalent CLI command
bun cli translations --clean-only --remove-obsolete
```

### Sort Trans-Unit Order

Reorder `<trans-unit>` elements in all XLF files so they follow the same order as `messages.en.xlf`. Before sorting, the command verifies that `messages.en.xlf` is in sync with the source code and exits with a list of differences if it is not.

```bash
# Sort all locales
make translations-sort

# Sort a specific locale
make translations-sort LOCALE=es
```

XML comments inside `<body>` (e.g. `<!-- Section name -->`) are discarded during sorting, as they would be out of context after reordering.

### Other CLI Options

```bash
# Extract + clean in one pass (no removal of obsolete keys)
bun cli translations

# Only clean formatting/invalid entries (no removal)
bun cli translations --clean-only

# Process a specific locale
bun cli translations --locale=es --extract-only
```

### Recommended Command Order

When doing a full translation maintenance cycle, run the commands in this order:

```bash
# 1. Remove obsolete keys (strings removed from the source code)
make translations-cleanup

# 2. Extract new keys from source code into all XLF files
make translations

# 3. Sort all XLF files to match the canonical order of messages.en.xlf
make translations-sort
```

All three commands accept an optional `LOCALE=xx` argument to restrict the operation to a single language.

## Extraction Sources

The extractor scans these directories and file types:

| Directory | Extensions | Patterns detected |
|-----------|------------|-------------------|
| `src/` | `*.ts` | `trans('key')`, `` `${TRANS_PREFIX}Key` `` |
| `views/` | `*.njk` | `'key' \| trans` |
| `public/app/` | `*.js` | `_('key')`, `c_('key')` |
| `public/libs/` | `*.js` | `_('key')`, `c_('key')` |
| `public/files/perm/idevices/` | `*.js` | `_('key')`, `c_('key')` |

## Controlling What Gets Extracted

The extractor has three mechanisms to exclude strings, all in `src/cli/commands/translations.ts`.

### `EXCLUDE_FILE_PATTERNS` — skip entire files or directories

Regex patterns matched against the full file path. Any file whose path matches is skipped entirely:

```typescript
const EXCLUDE_FILE_PATTERNS = [
    /\.spec\.ts$/,           // Backend test files
    /\.test\.js$/,           // Frontend test files
    /[\\/]+exe_math[\\/]+/,  // MathJax (has its own _() calls)
    /[\\/]+node_modules[\\/]+/,
    // Admin panel excluded — see "Admin Panel" section below
    /[\\/]+views[\\/]+admin[\\/]+/,
    /[\\/]+app[\\/]+admin[\\/]+/,
    /[\\/]+routes[\\/]+admin/,
];
```

To exclude a new directory, add a regex entry here.

### `EXCLUDE_EXACT_KEYS` — skip specific strings by exact value

A `Set<string>` of exact key values to ignore. Use this when a file contains strings that look like translation calls but are not UI labels (e.g. math expressions, code examples):

```typescript
const EXCLUDE_EXACT_KEYS = new Set([
    'P + \\\\tfrac12 \\\\rho v^2 + \\\\rho g h = \\\\text{constant}',
    // ^ Bernoulli equation example in edicuatex lang file
]);
```

Note the double escaping: each `\\` in the source file on disk becomes `\\\\` in a TypeScript string literal (since the extractor reads raw file text, not evaluated JS values).

### `INVALID_KEY_PATTERNS` — skip keys matching a pattern

Regex patterns matched against extracted key values. Keys matching any pattern are silently discarded. Used to filter out test fixture strings and documentation examples that accidentally match translation patterns:

```typescript
const INVALID_KEY_PATTERNS = [
    /^test\./,         // test.key, test.something
    /^pattern\./,      // pattern.trans, pattern.t
    /^nonexistent\./,  // nonexistent.translation.key
    /^key$/,           // just "key"
    // ...
];
```

## Admin Panel

The admin panel (`/admin`) is **always displayed in English**, regardless of the user's locale. This is intentional: the admin interface targets technical users and keeping it in a single language simplifies maintenance.

### How it works

Translations for the admin panel are built by `buildAdminTranslations(locale)` in `src/routes/admin.ts`. The call site in `src/routes/pages.ts` hardcodes `'en'` as the locale:

```typescript
// src/routes/pages.ts
const t = buildAdminTranslations('en'); // Admin panel is English-only
```

The admin source files (`views/admin/`, `public/app/admin/`, `src/routes/admin*`) are also excluded from the main translation scanner via `EXCLUDE_FILE_PATTERNS`, so their strings never appear in the XLF files.

### Enabling translations for the admin panel

If you want to translate the admin panel into other languages:

1. **`src/routes/pages.ts`** — replace `'en'` with the `locale` variable:

   ```typescript
   const t = buildAdminTranslations(locale); // re-enabled translations
   ```

2. **`src/cli/commands/translations.ts`** — comment out the three admin exclusions in `EXCLUDE_FILE_PATTERNS` (currently lines 43–45):

   ```typescript
   // Comment the following 3 lines to scan the admin panel
   // /[\\/]+views[\\/]+admin[\\/]+/,
   // /[\\/]+app[\\/]+admin[\\/]+/,
   // /[\\/]+routes[\\/]+admin/,
   ```

3. Run the normal extraction workflow to populate the XLF files:

   ```bash
   make translations
   ```

4. Translate the new `<target>` entries in each `translations/messages.*.xlf` file.

## Adding a New Language

1. Add the locale to `LOCALES` in `src/services/translation.ts`:

```typescript
export const LOCALES: Record<string, string> = {
    en: 'English',
    es: 'Español',
    fr: 'Français',  // New language
    // ...
};
```

2. Create the XLF file:

```bash
cp translations/messages.en.xlf translations/messages.fr.xlf
```

3. Update `target-language` in the new XLF file's `<file>` element, then translate the `<target>` entries.

4. Run extraction to add any missing keys:

```bash
make translations LOCALE=fr
```

## XLF File Format

```xml
<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en" target-language="es" datatype="plaintext">
    <body>
      <trans-unit id="abc123" resname="welcome.message">
        <source>Welcome to eXeLearning</source>
        <target>Bienvenido a eXeLearning</target>
      </trans-unit>
    </body>
  </file>
</xliff>
```

- `resname` — the key as it appears in source code (XML-escaped if it contains `&`, `<`, `>`, `"`)
- `<source>` — the English string
- `<target>` — the translated string; empty means untranslated

## Locale Detection

The server detects the user's locale from:

1. User preference (stored in session/profile)
2. `Accept-Language` HTTP header
3. Default locale (`en`)

```typescript
import { detectLocaleFromHeader, setLocale } from '../services/translation';

const locale = detectLocaleFromHeader(request.headers.get('accept-language'));
setLocale(locale);
```

## Best Practices

- Use natural-language strings as keys (`_('Export page')`) rather than dot-notation keys (`_('menu.export.page')`); this is the established pattern in this codebase.
- Run `make translations` after adding any new translatable strings.
- Run `make translations-cleanup` periodically to remove keys that no longer exist in the source.
- Run `make translations-sort` to keep all XLF files consistently ordered (makes diffs easier to review).
- Never hardcode UI strings — always wrap them in `_()`, `c_()`, or `trans()`.

---

## See Also

- [Development Environment](environment.md)
- [Architecture Overview](../architecture.md)
