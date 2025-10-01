# Translation System

## Overview

The translation system used in this application is based on Symfony's **Translation** component, which provides a flexible and scalable way to manage multilingual content.

Currently, the application supports the following languages:

* **English** (default language)
* **Spanish**
* **Catalan**

Translations are organized in `.xlf` (XLIFF) files located in the `translations/` directory. These files allow efficient management of translatable strings used across both `.php` and `.js` files, thanks to a custom extractor.

---

### Locale Configuration

To enable and manage supported languages, you need to configure the **locales** in the `settings.php` file. This file defines which languages are active and the default fallback locale.

Example configuration in `settings.php`:

```php
<?php

// Active locales for which translations will be extracted
public const LOCALES = [
    'en' => 'English',
    'es' => 'Español',
    'ca' => 'Català'
];

// Default locale to be used when no translation is available
public const DEFAULT_LOCALE = 'en';
```

---

### Translation Generation

To extract translatable strings and update the `.xlf` files, use the following `make` command:

```bash
make translations
```

This command:

* Ensures that Docker and the environment are properly configured.
* Runs the Symfony translation extractor inside the container via Composer.
* Updates all `.xlf` files for the languages defined in `settings.php`.

> Internally, this invokes:
>
> ```bash
> docker compose exec exelearning composer --no-cache translations:extract
> ```

The resulting `.xlf` files are stored in the `translations/` directory and contain strings from both PHP and JavaScript sources.

There is no need to run the extraction manually via Symfony or Composer — always use `make translations` to keep everything consistent.

---

### JavaScript Translation Support

In addition to PHP, the system supports extracting translations from JavaScript files. A custom **Extractor** processes `.js` files and ensures those strings are also available for translation.

This extractor runs automatically when you execute `make translations`, so no extra steps are required to support `.js` translation strings.

---

### Additional Notes

* The default language is **English**. If a translation is missing, the English version is shown.
* Always regenerate translation files when you add new translatable strings by running `make translations` or `composer translations:extract`.
* To support a new language, simply add it to the `LOCALES` array in `settings.php` and run the extraction command to generate the corresponding `.xlf` files.

---

## Add a New Language

1) Add the locale to `LOCALES` in `settings.php` (e.g., `'fr' => 'Français'`).

2) Extract translations:

```bash
make translations
```

3) Edit the generated `translations/messages.<locale>.xlf` files and provide translations.

4) Test locally by setting the app locale to the new language in your dev environment (or by switching language where available in the UI).

---

## See Also

- Developer environment: [development/environment.md](environment.md)

