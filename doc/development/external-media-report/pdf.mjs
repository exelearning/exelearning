/**
 * Turn `informe.html` into the distributable PDF.
 *
 * Screen media, not print: the report's figures and tables are styled for a screen, and
 * Chromium's print stylesheet collapses them into something that no longer shows what the
 * captures were taken to show.
 *
 * Was an ad-hoc command each time, which is how a report gets regenerated with one setting
 * quietly different from the last.
 */
import { chromium } from '@playwright/test';
import { statSync } from 'node:fs';
import { join } from 'node:path';

const HTML = join(import.meta.dirname, 'informe.html');
const PDF = join(import.meta.dirname, 'informe-migracion-external-media.pdf');

const browser = await chromium.launch();
const page = await browser.newPage();

// The document inlines every capture as a data URI, so it is tens of megabytes and the
// default navigation budget is not enough on a cold run.
await page.goto(`file://${HTML}`, { waitUntil: 'load', timeout: 300_000 });
await page.emulateMedia({ media: 'screen' });

await page.pdf({
    path: PDF,
    format: 'A4',
    printBackground: true,
    margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
});

await browser.close();
console.log(`${PDF} (${(statSync(PDF).size / 1_048_576).toFixed(1)} MB)`);
