/**
 * Deterministic fixture builders for the preview-refresh benchmark.
 *
 * Two kinds of content are produced:
 *
 * 1. A text-only `.elpx` skeleton (this file, Node side) — a ZIP with a single
 *    `content.xml` describing N pages, each with one Text iDevice. This is the
 *    exact ODE format the app's own ElpxImporter reads (mirrors the shape of
 *    test/fixtures/external-media-youtube-vimeo-pdf.elpx), so importing it
 *    exercises the real browser import path.
 *
 * 2. Binary assets (images + one large video) are NOT put in the ELPX. They are
 *    generated deterministically IN THE BROWSER (see browserAssets.ts) and
 *    inserted through the app's own `AssetManager.insertImage()` — exactly what
 *    happens when a user drops an image into a page. This avoids transferring a
 *    50 MiB blob over CDP and sidesteps any import asset-rewriting subtlety: the
 *    asset is guaranteed to be registered and referenced.
 *
 * Everything is seeded, so the baseline run and a later `after.json` run build
 * byte-identical fixtures and the comparison is fair.
 */
import { zipSync, strToU8 } from 'fflate';

/** Small deterministic PRNG (mulberry32) → uuid-like ids, stable across runs. */
function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Deterministic uuid-like string from a PRNG (format only, not RFC-random). */
function deterministicUuid(rand: () => number): string {
    const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join('');
    return `${hex(8)}-${hex(4)}-4${hex(3)}-${hex(4)}-${hex(12)}`;
}

function escapeXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const CONTENT_DTD_DOCTYPE = '<!DOCTYPE ode SYSTEM "content.dtd">';

/**
 * Build a single Text-iDevice page (odeNavStructure) block of XML.
 * The htmlView carries a stable marker span so a later "text edit" can be
 * verified in the rendered preview and so each page's HTML is distinct.
 */
function pageXml(pageIndex: number, ids: { pageId: string; blockId: string; ideviceId: string }): string {
    const { pageId, blockId, ideviceId } = ids;
    const pageName = `Page ${pageIndex}`;
    // Inner HTML of the text idevice. `bench-marker` is what edit scenarios mutate.
    const innerHtml =
        `<div class="exe-text-template"><h2>Section ${pageIndex}</h2>` +
        `<p>Deterministic benchmark paragraph for page ${pageIndex}. ` +
        `<span class="bench-marker" id="bench-marker-${pageIndex}">rev0</span></p>` +
        `<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod ` +
        `tempor incididunt ut labore et dolore magna aliqua. Page ${pageIndex}.</p></div>`;
    const jsonProps = JSON.stringify({
        ideviceId,
        textTextarea: innerHtml,
        textFeedbackInput: 'Show Feedback',
        textFeedbackTextarea: '',
    });
    return `<odeNavStructure>
  <odePageId>${pageId}</odePageId>
  <odeParentPageId></odeParentPageId>
  <pageName>${escapeXml(pageName)}</pageName>
  <odeNavStructureOrder>${pageIndex}</odeNavStructureOrder>
  <odeNavStructureProperties>
    <odeNavStructureProperty>
      <key>titlePage</key>
      <value>${escapeXml(pageName)}</value>
    </odeNavStructureProperty>
  </odeNavStructureProperties>
  <odePagStructures>
    <odePagStructure>
      <odePageId>${pageId}</odePageId>
      <odeBlockId>${blockId}</odeBlockId>
      <blockName>Text</blockName>
      <iconName></iconName>
      <odePagStructureOrder>1</odePagStructureOrder>
      <odePagStructureProperties>
        <odePagStructureProperty><key>visibility</key><value>true</value></odePagStructureProperty>
        <odePagStructureProperty><key>teacherOnly</key><value>false</value></odePagStructureProperty>
        <odePagStructureProperty><key>allowToggle</key><value>true</value></odePagStructureProperty>
        <odePagStructureProperty><key>minimized</key><value>false</value></odePagStructureProperty>
        <odePagStructureProperty><key>cssClass</key><value></value></odePagStructureProperty>
      </odePagStructureProperties>
      <odeComponents>
        <odeComponent>
          <odePageId>${pageId}</odePageId>
          <odeBlockId>${blockId}</odeBlockId>
          <odeIdeviceId>${ideviceId}</odeIdeviceId>
          <odeIdeviceTypeName>text</odeIdeviceTypeName>
          <htmlView><![CDATA[${innerHtml}]]></htmlView>
          <jsonProperties><![CDATA[${jsonProps}]]></jsonProperties>
          <odeComponentsOrder>0</odeComponentsOrder>
          <odeComponentsProperties>
          </odeComponentsProperties>
        </odeComponent>
      </odeComponents>
    </odePagStructure>
  </odePagStructures>
</odeNavStructure>`;
}

/** Ids for every page, derived from a single seed so runs are reproducible. */
export interface PageIds {
    pageId: string;
    blockId: string;
    ideviceId: string;
}

export function buildPageIds(pageCount: number, seed: number): PageIds[] {
    const rand = mulberry32(seed);
    const ids: PageIds[] = [];
    for (let i = 0; i < pageCount; i++) {
        ids.push({
            pageId: deterministicUuid(rand),
            blockId: `block-${deterministicUuid(rand).slice(0, 13)}`,
            ideviceId: `idevice-${deterministicUuid(rand).slice(0, 13)}`,
        });
    }
    return ids;
}

/** Assemble the full content.xml for `pageCount` text pages. */
export function buildContentXml(pageCount: number, title: string, ids: PageIds[]): string {
    const pages = ids.map((id, i) => pageXml(i, id)).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
${CONTENT_DTD_DOCTYPE}
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<userPreferences>
  <userPreference><key>theme</key><value>base</value></userPreference>
</userPreferences>
<odeResources>
  <odeResource><key>odeId</key><value>bench000000000000000</value></odeResource>
  <odeResource><key>odeVersionId</key><value>benchver00000000000</value></odeResource>
  <odeResource><key>exe_version</key><value>0.0.0-alpha</value></odeResource>
</odeResources>
<odeProperties>
  <odeProperty><key>pp_title</key><value>${escapeXml(title)}</value></odeProperty>
  <odeProperty><key>pp_lang</key><value>en</value></odeProperty>
  <odeProperty><key>pp_theme</key><value>base</value></odeProperty>
  <odeProperty><key>pp_exelearning_version</key><value>v0.0.0-alpha</value></odeProperty>
  <odeProperty><key>pp_addExeLink</key><value>true</value></odeProperty>
  <odeProperty><key>pp_addPagination</key><value>false</value></odeProperty>
  <odeProperty><key>pp_addSearchBox</key><value>false</value></odeProperty>
  <odeProperty><key>exportSource</key><value>true</value></odeProperty>
  <odeProperty><key>pp_globalFont</key><value>default</value></odeProperty>
</odeProperties>
<odeNavStructures>
${pages}
</odeNavStructures>
</ode>`;
}

/**
 * Build a text-only `.elpx` (ZIP) for `pageCount` pages and return its bytes.
 * A single `content.xml` is enough for the importer: the DTD is referenced by
 * name only (DOMParser never fetches it) and idevice/theme runtime files are
 * re-fetched from the server on export.
 */
export function buildTextElpx(pageCount: number, title: string, seed: number): Uint8Array {
    const ids = buildPageIds(pageCount, seed);
    const contentXml = buildContentXml(pageCount, title, ids);
    return zipSync({ 'content.xml': strToU8(contentXml) }, { level: 6 });
}
