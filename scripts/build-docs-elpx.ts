#!/usr/bin/env bun
/**
 * build-docs-elpx.ts — publish the plugin manuals as eXeLearning projects.
 *
 * Reads the administrator and teacher manuals from a built MkDocs site and
 * writes one `.elpx` per manual and language next to them, so teachers can
 * open the manual in eXeLearning, adapt it and republish it (#2536).
 *
 * Each top-level heading (`<h1>`) of the manual becomes a page and each
 * `<h2>` a block with one Text iDevice. Screenshots become project assets and
 * relative links point to the published documentation site. The generated
 * `content.xml` goes through the regular `elp:export` pipeline (ElpxImporter →
 * Y.Doc → ElpxExporter), so the result is the same as an editor export.
 *
 * Usage:
 *   bun scripts/build-docs-elpx.ts <siteDir> <siteUrl>
 *
 * Example (after `mkdocs build -d site-docs`):
 *   bun scripts/build-docs-elpx.ts site-docs https://exelearning.github.io/exelearning
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { zipSync } from 'fflate';
import { JSDOM } from 'jsdom';
import { execute as elpExport } from '../src/cli/commands/elp-export';

export interface ManualSpec {
    /** Page directory inside the built site, e.g. `plugins/manual-admin.es`. */
    page: string;
    /** Output file inside the built site, e.g. `plugins/manual-admin.es.elpx`. */
    output: string;
    lang: string;
    /** Title of the page that holds everything before the first `<h1>`. */
    introTitle: string;
}

export const MANUALS: ManualSpec[] = [
    { page: 'plugins/manual-admin', output: 'plugins/manual-admin.elpx', lang: 'en', introTitle: 'Introduction' },
    {
        page: 'plugins/manual-teacher',
        output: 'plugins/manual-teacher.elpx',
        lang: 'en',
        introTitle: 'Introduction',
    },
    {
        page: 'plugins/manual-admin.es',
        output: 'plugins/manual-admin.es.elpx',
        lang: 'es',
        introTitle: 'Introducción',
    },
    {
        page: 'plugins/manual-teacher.es',
        output: 'plugins/manual-teacher.es.elpx',
        lang: 'es',
        introTitle: 'Introducción',
    },
];

export interface ManualBlock {
    title: string;
    html: string;
}

export interface ManualPage {
    title: string;
    blocks: ManualBlock[];
}

export interface ManualContent {
    title: string;
    pages: ManualPage[];
    /** ZIP path (`content/resources/...`) → URL path of the image inside the site. */
    assets: Map<string, string>;
}

/** Web-only chrome that makes no sense inside an eXeLearning project. */
const REMOVE_SELECTORS = [
    'a.headerlink',
    '.lang-switch',
    '.manual-logo',
    '.manual-download',
    '.md-content__button',
    '.md-source-file',
    '.linenos',
];

const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Split a built manual page into eXeLearning pages and blocks.
 *
 * @param html     Built HTML of the manual page.
 * @param pageUrl  Published URL of that page (ends with `/`), used to resolve links and images.
 * @param introTitle Title of the page that holds the content before the first `<h1>` section.
 */
export function extractManual(html: string, pageUrl: string, introTitle: string): ManualContent {
    const { document } = new JSDOM(html).window;
    const article = document.querySelector('article.md-content__inner') ?? document.body;

    for (const selector of REMOVE_SELECTORS) {
        for (const node of article.querySelectorAll(selector)) node.remove();
    }
    for (const p of article.querySelectorAll('p')) {
        if (!p.textContent?.trim() && !p.querySelector('img')) p.remove();
    }

    const assets = new Map<string, string>();
    for (const img of article.querySelectorAll('img')) {
        const url = new URL(img.getAttribute('src') ?? '', pageUrl);
        const relative = url.pathname.split('/img/').pop() ?? path.posix.basename(url.pathname);
        const zipPath = `content/resources/${relative}`;
        assets.set(zipPath, url.pathname);
        img.setAttribute('src', `{{context_path}}/${zipPath}`);
        img.removeAttribute('srcset');
    }
    for (const link of article.querySelectorAll('a[href]')) {
        const href = link.getAttribute('href') ?? '';
        if (!ABSOLUTE_URL.test(href)) link.setAttribute('href', new URL(href, pageUrl).href);
    }
    for (const admonition of article.querySelectorAll('div.admonition')) {
        const quote = document.createElement('blockquote');
        quote.className = admonition.className;
        const title = admonition.querySelector(':scope > .admonition-title');
        if (title) {
            const strong = document.createElement('strong');
            strong.textContent = title.textContent ?? '';
            const p = document.createElement('p');
            p.append(strong);
            title.replaceWith(p);
        }
        quote.append(...admonition.childNodes);
        admonition.replaceWith(quote);
    }

    let title = '';
    const pages: ManualPage[] = [];
    let page: ManualPage | null = null;
    let block: ManualBlock | null = null;
    for (const node of [...article.children]) {
        const tag = node.tagName.toLowerCase();
        const text = node.textContent?.trim() ?? '';
        if (tag === 'h1' && !title) {
            title = text;
            continue;
        }
        if (tag === 'h1') {
            page = { title: text, blocks: [] };
            pages.push(page);
            block = null;
            continue;
        }
        if (!page) {
            page = { title: introTitle, blocks: [] };
            pages.push(page);
        }
        if (tag === 'h2') {
            block = { title: text, html: '' };
            page.blocks.push(block);
            continue;
        }
        if (!block) {
            block = { title: '', html: '' };
            page.blocks.push(block);
        }
        block.html += node.outerHTML;
    }

    return { title, pages, assets };
}

const escapeXml = (value: string): string =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cdata = (value: string): string => `<![CDATA[${value.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;

const property = (tag: string, key: string, value: string): string =>
    `<${tag}><key>${key}</key><value>${escapeXml(value)}</value></${tag}>`;

/**
 * Deterministic ODE identifiers (`YYYYMMDDHHmmss` + 6 uppercase characters), so
 * rebuilding the same manual yields the same project structure.
 */
export function makeIdFactory(prefix = '20260101000000'): () => string {
    let counter = 0;
    return () => prefix + (counter++).toString(36).toUpperCase().padStart(6, '0');
}

/** Build a `content.xml` with one Text iDevice per block. */
export function buildContentXml(manual: ManualContent, lang: string, nextId = makeIdFactory()): string {
    const odeId = nextId();
    const pagesXml = manual.pages
        .map((page, pageIndex) => {
            const pageId = nextId();
            const blocksXml = page.blocks
                .map((block, blockIndex) => {
                    const blockId = nextId();
                    const ideviceId = nextId();
                    const htmlView = `<div class="exe-text-template"><div class="textIdeviceContent"><div class="exe-text-activity"><div>${block.html}</div></div></div></div>`;
                    const json = JSON.stringify({ ideviceId, textTextarea: block.html });
                    return [
                        '<odePagStructure>',
                        `<odePageId>${pageId}</odePageId><odeBlockId>${blockId}</odeBlockId>`,
                        `<blockName>${escapeXml(block.title)}</blockName><iconName></iconName>`,
                        `<odePagStructureOrder>${blockIndex + 1}</odePagStructureOrder>`,
                        '<odePagStructureProperties>',
                        property('odePagStructureProperty', 'visibility', 'true'),
                        property('odePagStructureProperty', 'teacherOnly', 'false'),
                        property('odePagStructureProperty', 'allowToggle', 'true'),
                        property('odePagStructureProperty', 'minimized', 'false'),
                        '</odePagStructureProperties>',
                        '<odeComponents><odeComponent>',
                        `<odePageId>${pageId}</odePageId><odeBlockId>${blockId}</odeBlockId>`,
                        `<odeIdeviceId>${ideviceId}</odeIdeviceId><odeIdeviceTypeName>text</odeIdeviceTypeName>`,
                        `<htmlView>${cdata(htmlView)}</htmlView>`,
                        `<jsonProperties>${cdata(json)}</jsonProperties>`,
                        '<odeComponentsOrder>1</odeComponentsOrder>',
                        `<odeComponentsProperties>${property('odeComponentsProperty', 'visibility', 'true')}</odeComponentsProperties>`,
                        '</odeComponent></odeComponents>',
                        '</odePagStructure>',
                    ].join('\n');
                })
                .join('\n');
            return [
                '<odeNavStructure>',
                `<odePageId>${pageId}</odePageId><odeParentPageId></odeParentPageId>`,
                `<pageName>${escapeXml(page.title)}</pageName>`,
                `<odeNavStructureOrder>${pageIndex + 1}</odeNavStructureOrder>`,
                '<odeNavStructureProperties>',
                property('odeNavStructureProperty', 'titlePage', page.title),
                '</odeNavStructureProperties>',
                `<odePagStructures>\n${blocksXml}\n</odePagStructures>`,
                '</odeNavStructure>',
            ].join('\n');
        })
        .join('\n');

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE ode SYSTEM "content.dtd">',
        '<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">',
        `<userPreferences>${property('userPreference', 'theme', 'base')}</userPreferences>`,
        '<odeResources>',
        property('odeResource', 'odeId', odeId),
        property('odeResource', 'odeVersionId', odeId),
        property('odeResource', 'exe_version', '3.0'),
        '</odeResources>',
        '<odeProperties>',
        property('odeProperty', 'pp_title', manual.title),
        property('odeProperty', 'pp_lang', lang),
        property('odeProperty', 'pp_author', 'eXeLearning'),
        property('odeProperty', 'license', 'creative commons: attribution - share alike 4.0'),
        property('odeProperty', 'pp_addExeLink', 'true'),
        property('odeProperty', 'pp_addPagination', 'true'),
        property('odeProperty', 'pp_addSearchBox', 'true'),
        property('odeProperty', 'exportSource', 'true'),
        '</odeProperties>',
        `<odeNavStructures>\n${pagesXml}\n</odeNavStructures>`,
        '</ode>',
    ].join('\n');
}

/** Build the manual's `.elpx` from a built MkDocs site. */
export async function buildManual(siteDir: string, siteUrl: string, spec: ManualSpec): Promise<string> {
    const base = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;
    const basePath = new URL(base).pathname;
    const pageUrl = new URL(`${spec.page}/`, base).href;
    const html = await fs.readFile(path.join(siteDir, spec.page, 'index.html'), 'utf8');
    const manual = extractManual(html, pageUrl, spec.introTitle);
    if (manual.pages.length === 0) throw new Error(`No content found in ${spec.page}`);

    const files: Record<string, Uint8Array> = {
        'content.xml': new TextEncoder().encode(buildContentXml(manual, spec.lang)),
    };
    for (const [zipPath, urlPath] of manual.assets) {
        if (!urlPath.startsWith(basePath)) throw new Error(`Image outside the site: ${urlPath}`);
        files[zipPath] = await fs.readFile(path.join(siteDir, decodeURIComponent(urlPath.slice(basePath.length))));
    }

    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-elpx-'));
    try {
        const source = path.join(workDir, 'source.elpx');
        await fs.writeFile(source, zipSync(files));
        const output = path.join(siteDir, spec.output);
        const result = await elpExport([source, output, 'elpx'], {});
        if (!result.success) throw new Error(`${spec.output}: ${result.message}`);
        return output;
    } finally {
        await fs.rm(workDir, { recursive: true, force: true });
    }
}

export async function main(argv: string[]): Promise<number> {
    const [siteDir, siteUrl] = argv;
    if (!siteDir || !siteUrl) {
        console.error('Usage: bun scripts/build-docs-elpx.ts <siteDir> <siteUrl>');
        return 1;
    }
    for (const spec of MANUALS) {
        console.log(`Built ${await buildManual(siteDir, siteUrl, spec)}`);
    }
    return 0;
}

if (import.meta.main) {
    process.exit(await main(process.argv.slice(2)));
}
