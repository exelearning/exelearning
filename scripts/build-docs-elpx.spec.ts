import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { unzipSync } from 'fflate';
import * as Y from 'yjs';
import { ElpxImporter } from '../src/shared/import';
import { buildContentXml, buildManual, extractManual, main, makeIdFactory, MANUALS } from './build-docs-elpx';

const SITE_URL = 'https://example.org/docs';
const PAGE_URL = `${SITE_URL}/plugins/manual-teacher/`;
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const manualHtml = `<!doctype html><html><body><article class="md-content__inner md-typeset">
<a class="md-content__button" href="edit">Edit</a>
<h1 id="title">Teacher Manual<a class="headerlink" href="#title">¶</a></h1>
<p><a class="lang-switch" href="../manual-teacher.es/">Leer en español</a></p>
<p><img class="manual-logo" src="../../logo.svg" alt="eXeLearning"></p>
<p>Lead paragraph.</p>
<div class="admonition tip manual-download"><p class="admonition-title">Save</p><p>Download.</p></div>
<h2 id="which">Which plugin?</h2>
<p>See <a href="../moodle/#faq">Moodle</a>, <a href="#which">here</a> and <a href="https://moodle.org">moodle.org</a>.</p>
<h1 id="moodle">Moodle</h1>
<p>Intro.</p>
<div class="admonition tip"><p class="admonition-title">Try it</p><p>Demo.</p></div>
<h2 id="teachers">For teachers</h2>
<h3>Edit</h3>
<p><img src="../img/moodle/editor.png" alt="Editor"></p>
</article></body></html>`;

describe('build-docs-elpx', () => {
    const tempDirs: string[] = [];
    afterEach(() => {
        for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
    });

    describe('extractManual', () => {
        it('turns every h1 into a page and every h2 into a block', () => {
            const manual = extractManual(manualHtml, PAGE_URL, 'Introduction');

            expect(manual.title).toBe('Teacher Manual');
            expect(manual.pages.map(page => page.title)).toEqual(['Introduction', 'Moodle']);
            expect(manual.pages[0].blocks.map(block => block.title)).toEqual(['', 'Which plugin?']);
            expect(manual.pages[1].blocks.map(block => block.title)).toEqual(['', 'For teachers']);
            expect(manual.pages[1].blocks[1].html).toContain('<h3>Edit</h3>');
        });

        it('drops web-only chrome: permalinks, language switch, logo, download tip and edit button', () => {
            const html = extractManual(manualHtml, PAGE_URL, 'Introduction')
                .pages.flatMap(page => page.blocks.map(block => block.html))
                .join('');

            expect(html).not.toContain('¶');
            expect(html).not.toContain('Leer en español');
            expect(html).not.toContain('logo.svg');
            expect(html).not.toContain('Download.');
            expect(html).not.toContain('Edit</a>');
            expect(html).toContain('Lead paragraph.');
        });

        it('points relative links to the published site and keeps absolute ones', () => {
            const html = extractManual(manualHtml, PAGE_URL, 'Introduction').pages[0].blocks[1].html;

            expect(html).toContain(`href="${SITE_URL}/plugins/moodle/#faq"`);
            expect(html).toContain(`href="${PAGE_URL}#which"`);
            expect(html).toContain('href="https://moodle.org"');
        });

        it('turns screenshots into project assets that keep their folder', () => {
            const manual = extractManual(manualHtml, PAGE_URL, 'Introduction');

            expect([...manual.assets]).toEqual([
                ['content/resources/moodle/editor.png', '/docs/plugins/img/moodle/editor.png'],
            ]);
            expect(manual.pages[1].blocks[1].html).toContain(
                'src="{{context_path}}/content/resources/moodle/editor.png"',
            );
        });

        it('renders admonitions as quotes with a bold title', () => {
            const html = extractManual(manualHtml, PAGE_URL, 'Introduction').pages[1].blocks[0].html;

            expect(html).toContain(
                '<blockquote class="admonition tip"><p><strong>Try it</strong></p><p>Demo.</p></blockquote>',
            );
        });
    });

    describe('buildContentXml', () => {
        it('writes one Text iDevice per block, with the language and escaped titles', () => {
            const xml = buildContentXml(
                {
                    title: 'A & B',
                    pages: [{ title: 'Page <1>', blocks: [{ title: 'Block', html: '<p>x]]>y</p>' }] }],
                    assets: new Map(),
                },
                'es',
            );

            expect(xml).toContain('<key>pp_title</key><value>A &amp; B</value>');
            expect(xml).toContain('<key>pp_lang</key><value>es</value>');
            expect(xml).toContain('<pageName>Page &lt;1&gt;</pageName>');
            expect(xml).toContain('<odeIdeviceTypeName>text</odeIdeviceTypeName>');
            expect(xml).toContain('x]]]]><![CDATA[>y');
        });

        it('is deterministic', () => {
            const manual = extractManual(manualHtml, PAGE_URL, 'Introduction');

            expect(buildContentXml(manual, 'en')).toBe(buildContentXml(manual, 'en'));
        });
    });

    it('makeIdFactory yields ODE-shaped unique ids', () => {
        const next = makeIdFactory();
        const ids = [next(), next()];

        expect(ids[0]).toMatch(/^\d{14}[A-Z0-9]{6}$/);
        expect(ids[0]).not.toBe(ids[1]);
    });

    describe('buildManual', () => {
        function makeSite(): string {
            const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-elpx-site-'));
            tempDirs.push(siteDir);
            fs.mkdirSync(path.join(siteDir, 'plugins/manual-teacher'), { recursive: true });
            fs.mkdirSync(path.join(siteDir, 'plugins/img/moodle'), { recursive: true });
            fs.writeFileSync(path.join(siteDir, 'plugins/manual-teacher/index.html'), manualHtml);
            fs.writeFileSync(path.join(siteDir, 'plugins/img/moodle/editor.png'), PNG);
            return siteDir;
        }

        it('writes an .elpx that eXeLearning imports with the same pages and images', async () => {
            const siteDir = makeSite();

            const output = await buildManual(siteDir, SITE_URL, MANUALS[1]);

            expect(output).toBe(path.join(siteDir, 'plugins/manual-teacher.elpx'));
            const zip = unzipSync(fs.readFileSync(output));
            expect(zip['content/resources/moodle/editor.png']).toEqual(PNG);

            const ydoc = new Y.Doc();
            const result = await new ElpxImporter(ydoc).importFromBuffer(new Uint8Array(fs.readFileSync(output)));
            expect(result.pages).toBe(2);
        });

        it('rejects a manual page with no content', async () => {
            const siteDir = makeSite();
            fs.writeFileSync(
                path.join(siteDir, 'plugins/manual-teacher/index.html'),
                '<article class="md-content__inner"></article>',
            );

            await expect(buildManual(siteDir, SITE_URL, MANUALS[1])).rejects.toThrow('No content found');
        });

        it('rejects an image outside the site', async () => {
            const siteDir = makeSite();
            fs.writeFileSync(
                path.join(siteDir, 'plugins/manual-teacher/index.html'),
                '<article class="md-content__inner"><h1>T</h1><p><img src="/elsewhere/x.png"></p></article>',
            );

            await expect(buildManual(siteDir, SITE_URL, MANUALS[1])).rejects.toThrow('Image outside the site');
        });
    });

    describe('main', () => {
        it('builds every manual of the site', async () => {
            const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-elpx-site-'));
            tempDirs.push(siteDir);
            fs.mkdirSync(path.join(siteDir, 'plugins/img/moodle'), { recursive: true });
            fs.writeFileSync(path.join(siteDir, 'plugins/img/moodle/editor.png'), PNG);
            for (const spec of MANUALS) {
                fs.mkdirSync(path.join(siteDir, spec.page), { recursive: true });
                fs.writeFileSync(path.join(siteDir, spec.page, 'index.html'), manualHtml);
            }
            const log = console.log;
            console.log = () => {};
            try {
                expect(await main([siteDir, SITE_URL])).toBe(0);
            } finally {
                console.log = log;
            }

            for (const spec of MANUALS) expect(fs.existsSync(path.join(siteDir, spec.output))).toBe(true);
        });

        it('prints usage and fails without arguments', async () => {
            const error = console.error;
            console.error = () => {};
            try {
                expect(await main([])).toBe(1);
            } finally {
                console.error = error;
            }
        });
    });
});
