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
// Using the __() or t() helper functions
const message = __('error.not_found');
const title = t('page.title');
```

## Translation Commands

### Extract New Translation Keys

Scan source files for translation function calls and add new keys to XLF files:

```bash
# Extract keys for all locales
bun cli translations

# Extract for a specific locale
bun cli translations --locale=es

# Only extract (skip cleanup)
bun cli translations --extract-only
```

### Clean XLF Files

Remove invalid entries and clean up formatting:

```bash
bun cli translations --clean-only
```

### Using Make

```bash
make translations
```

## Extraction Sources

The extractor scans these patterns:

| Directory | Extensions | Patterns |
|-----------|------------|----------|
| `src/` | `*.ts` | `trans('key')`, `__('key')`, `t('key')` |
| `views/` | `*.njk` | `trans('key')`, `__('key')`, `t('key')` |
| `public/app/` | `*.js` | `trans('key')`, `__('key')`, `t('key')` |

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
# Copy English as a starting point
cp translations/messages.en.xlf translations/messages.fr.xlf
```

3. Edit the new XLF file:
   - Update `target-language` attribute in the `<file>` element
   - Translate the `<target>` elements

4. Run extraction to add any missing keys:

```bash
bun cli translations --locale=fr
```

## XLF File Format

Translation entries use the standard XLIFF format:

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

## Locale Detection

The server detects the user's locale from:

1. User preference (stored in session/profile)
2. `Accept-Language` HTTP header
3. Default locale (`en`)

```typescript
import { detectLocaleFromHeader, setLocale } from '../services/translation';

// Auto-detect from request
const locale = detectLocaleFromHeader(request.headers.get('accept-language'));
setLocale(locale);
```

## Best Practices

- Use descriptive, hierarchical keys: `error.file.not_found` instead of `err1`
- Keep translations consistent across files
- Run `bun cli translations` after adding new translatable strings
- Test the UI in multiple languages during development

---

## See Also

- [Development Environment](environment.md)
- [Architecture Overview](../architecture.md)
