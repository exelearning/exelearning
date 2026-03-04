#!/usr/bin/env bun
/**
 * Build i18n bundles
 *
 * Generates public/app/common/i18n/common_i18n.{lang}.js for each locale
 * by resolving c_("...") calls in the template with XLF translations.
 *
 * The template (public/app/common/common_i18n.js) uses c_() for extractability
 * by `make translations`. The generated files are fully resolved — no c_()
 * calls remain, so they can be loaded as plain scripts without any runtime
 * translation function.
 */

import { parseXlfTranslations, generateI18nScript } from '../src/shared/export/generators/I18nGenerator.ts';
import { LOCALES } from '../src/services/translation.ts';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(import.meta.dir, '..');
const TEMPLATE_PATH = path.join(ROOT, 'public', 'app', 'common', 'common_i18n.js');
const OUTPUT_DIR = path.join(ROOT, 'public', 'app', 'common', 'i18n');
const TRANSLATIONS_DIR = path.join(ROOT, 'translations');

const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

let count = 0;
for (const lang of Object.keys(LOCALES)) {
    const xlfPath = path.join(TRANSLATIONS_DIR, `messages.${lang}.xlf`);
    let translations = new Map();
    if (fs.existsSync(xlfPath)) {
        const xlf = fs.readFileSync(xlfPath, 'utf-8');
        translations = parseXlfTranslations(xlf);
    }
    const output = generateI18nScript(template, translations);
    fs.writeFileSync(path.join(OUTPUT_DIR, `common_i18n.${lang}.js`), output, 'utf-8');
    count++;
}

console.log(`  ${count} locale files generated in public/app/common/i18n/`);
console.log('i18n bundles built successfully');
