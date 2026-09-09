/**
 * Guards the MIME-type portability of the static distribution.
 *
 * The static build is published as a ZIP and self-hosted on servers we do not
 * control. nginx (and other common static servers) have no `.mjs` entry in
 * their MIME table and fall back to `application/octet-stream`, which browsers
 * reject for module scripts. Assets we load with `import()` must therefore use
 * an extension every server already maps to JavaScript.
 *
 * See public/libs/pdfjs/README.md.
 */

import { describe, it, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve(import.meta.dir, '..');
const pdfjsDir = path.join(projectRoot, 'public/libs/pdfjs');

/** Source files that load PDF.js through a browser `import()`. */
const PDFJS_CONSUMERS = [
    'public/preview-sw.js',
    'public/app/workarea/interface/elements/previewPanel.js',
];

describe('vendored PDF.js bundles', () => {
    it('ships the display and worker bundles with a .js extension', () => {
        expect(fs.existsSync(path.join(pdfjsDir, 'pdf.min.js'))).toBe(true);
        expect(fs.existsSync(path.join(pdfjsDir, 'pdf.worker.min.js'))).toBe(true);
    });

    it('ships no .mjs file, which servers serve as application/octet-stream', () => {
        const mjsFiles = fs.readdirSync(pdfjsDir).filter((f) => f.endsWith('.mjs'));
        expect(mjsFiles).toEqual([]);
    });
});

describe('PDF.js consumers', () => {
    for (const relPath of PDFJS_CONSUMERS) {
        it(`${relPath} imports PDF.js from a .js URL`, () => {
            const source = fs.readFileSync(path.join(projectRoot, relPath), 'utf-8');

            expect(source).toContain('libs/pdfjs/pdf.min.js');
            expect(source).toContain('libs/pdfjs/pdf.worker.min.js');
            expect(source).not.toContain('libs/pdfjs/pdf.min.mjs');
            expect(source).not.toContain('libs/pdfjs/pdf.worker.min.mjs');
        });

        it(`${relPath} sets workerSrc explicitly`, () => {
            const source = fs.readFileSync(path.join(projectRoot, relPath), 'utf-8');

            // The bundle's built-in default resolves to "./pdf.worker.mjs",
            // which does not exist in our vendored copy.
            expect(source).toContain('GlobalWorkerOptions.workerSrc');
        });
    }
});

describe('static nginx image MIME configuration', () => {
    const confPath = path.join(projectRoot, 'docker/nginx/mime-extra.conf');

    it('maps the extensions missing from the nginx mime.types table', () => {
        const conf = fs.readFileSync(confPath, 'utf-8');

        expect(conf).toMatch(/text\/javascript\s+mjs;/);
        expect(conf).toMatch(/font\/ttf\s+ttf;/);
        expect(conf).toMatch(/font\/otf\s+otf;/);
        expect(conf).toMatch(/text\/vtt\s+vtt;/);
        expect(conf).toMatch(/model\/gltf-binary\s+glb;/);
        expect(conf).toMatch(/model\/gltf\+json\s+gltf;/);
        expect(conf).toMatch(/model\/stl\s+stl;/);
        expect(conf).toMatch(/application\/manifest\+json\s+webmanifest;/);
    });

    it('is copied into the nginx config directory by Dockerfile.static', () => {
        const dockerfile = fs.readFileSync(path.join(projectRoot, 'Dockerfile.static'), 'utf-8');

        expect(dockerfile).toContain('COPY docker/nginx/mime-extra.conf /etc/nginx/conf.d/mime-extra.conf');
    });

    it('is reachable from the Docker build context', () => {
        const dockerignore = fs.readFileSync(path.join(projectRoot, '.dockerignore'), 'utf-8');
        const patterns = dockerignore
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#'));

        expect(patterns).not.toContain('docker/');
        expect(patterns).not.toContain('docker/nginx/mime-extra.conf');
    });
});
