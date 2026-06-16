/**
 * Generates test/fixtures/pdf-noext-iframe.elpx — a minimal .elpx that
 * reproduces the bug where a PDF is embedded in an <iframe> via an
 * extension-less resource path (`content/resources/asset-<uuid>`), causing the
 * static viewer to force-download it.
 *
 * Derived from really-simple-test-project.elpx (content.xml + content.dtd only,
 * which is all the importer needs) plus one injected iframe and a tiny PDF.
 *
 * Run once with: node test/fixtures/scripts/build-pdf-noext-fixture.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '..');

const ASSET_UUID = 'aaaaaaaa-1111-2222-3333-444444444444';
const RESOURCE_PATH = `content/resources/asset-${ASSET_UUID}`; // NOTE: no extension — this is the bug
const IFRAME = `<p><iframe width="320" height="240" src="{{context_path}}/${RESOURCE_PATH}" data-mce-fragment="1"></iframe></p>`;

// Minimal, valid single-page PDF (starts with the %PDF- magic bytes).
const MINIMAL_PDF =
    '%PDF-1.4\n' +
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n' +
    'trailer<</Root 1 0 R>>\n' +
    '%%EOF\n';

const base = readFileSync(join(fixturesDir, 'really-simple-test-project.elpx'));
const entries = unzipSync(new Uint8Array(base));

let contentXml = strFromU8(entries['content.xml']);
// Inject the iframe into the first text iDevice's rendered HTML (CDATA htmlView).
const anchor = '<div class="exe-text-activity">';
const idx = contentXml.indexOf(anchor);
if (idx === -1) throw new Error('anchor not found in content.xml');
contentXml = contentXml.replace(anchor, `${anchor}${IFRAME}`);

// Keep every original entry (idevices/, libs/, theme/, index.html, …) so the
// package imports exactly like the base project; only swap content.xml and add
// the extension-less PDF resource.
const out = { ...entries };
out['content.xml'] = strToU8(contentXml);
out[RESOURCE_PATH] = strToU8(MINIMAL_PDF);

const zipped = zipSync(out, { level: 6 });
const target = join(fixturesDir, 'pdf-noext-iframe.elpx');
writeFileSync(target, zipped);
console.log(`Wrote ${target} (${zipped.length} bytes), resource: ${RESOURCE_PATH}`);
