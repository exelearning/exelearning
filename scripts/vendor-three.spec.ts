import { describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {
    buildVendoredFiles,
    rewriteAddonImports,
    THREE_D_EXPORT,
    THREE_SIXTY_EXPORT,
    threeVersion,
    writeVendoredFiles,
} from './vendor-three';

// "0.186.1" -> "186": three's REVISION is the minor version.
const revision = threeVersion().split('.')[1];
const files = await buildVendoredFiles();
const moduleBuild = files[path.join(THREE_D_EXPORT, 'three.module.min.js')];
const classicBuild = files[path.join(THREE_SIXTY_EXPORT, 'three.min.js')];

describe('vendor-three', () => {
    it('runs as part of bundle:vendor', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(import.meta.dir, '../package.json'), 'utf-8'));
        expect(pkg.scripts['bundle:vendor']).toContain('scripts/vendor-three.ts');
        // An exact pin keeps the minified output reproducible across installs.
        expect(pkg.devDependencies.esbuild).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('produces the four viewer files, reproducibly', async () => {
        expect(Object.keys(files).map(f => path.relative(path.join(THREE_D_EXPORT, '../..'), f))).toEqual([
            'three-d-viewer/export/three.module.min.js',
            'three-sixty-viewer/export/three.min.js',
            'three-d-viewer/export/OrbitControls.js',
            'three-d-viewer/export/STLLoader.js',
        ]);
        expect(await buildVendoredFiles()).toEqual(files);
    });

    it('rewrites the bare three import to the sibling module build', () => {
        expect(rewriteAddonImports("import {\n\tVector3\n} from 'three';\n")).toBe(
            "import {\n\tVector3\n} from './three.module.min.js';\n",
        );
        for (const name of ['OrbitControls.js', 'STLLoader.js']) {
            const addon = files[path.join(THREE_D_EXPORT, name)];
            expect(addon).toContain("from './three.module.min.js';");
            expect(addon).not.toContain("from 'three'");
        }
    });

    it('3D viewer module build exposes the pinned REVISION', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vendor-three-'));
        try {
            const file = path.join(dir, 'three.module.min.js');
            fs.writeFileSync(file, moduleBuild);
            const three = await import(file);
            expect(three.REVISION).toBe(revision);
            expect(typeof three.WebGLRenderer).toBe('function');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('writes every file, creating missing directories', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vendor-three-write-'));
        try {
            const file = path.join(dir, 'nested', 'three.min.js');
            writeVendoredFiles({ [file]: 'x' });
            expect(fs.readFileSync(file, 'utf-8')).toBe('x');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('360 viewer classic build defines window.THREE with OrbitControls', () => {
        const context: { THREE?: Record<string, unknown> } = {};
        vm.createContext(context);
        vm.runInContext(classicBuild, context);
        expect(context.THREE?.REVISION).toBe(revision);
        for (const name of [
            'Scene',
            'PerspectiveCamera',
            'WebGLRenderer',
            'SphereGeometry',
            'TextureLoader',
            'OrbitControls',
        ]) {
            expect(typeof context.THREE?.[name], name).toBe('function');
        }
    });
});
