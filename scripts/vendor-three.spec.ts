import { describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
    buildVendoredFiles,
    rewriteAddonImports,
    THREE_D_EXPORT,
    THREE_SIXTY_EXPORT,
    threeVersion,
} from './vendor-three';

// "0.186.1" -> "186": three's REVISION is the minor version.
const revision = threeVersion().split('.')[1];

describe('vendor-three', () => {
    it('committed files match what the pinned three package produces (run `make vendor-three`)', async () => {
        for (const [file, contents] of Object.entries(await buildVendoredFiles())) {
            expect(fs.readFileSync(file, 'utf-8'), path.relative(process.cwd(), file)).toBe(contents);
        }
    });

    it('rewrites the bare three import to the sibling module build', () => {
        expect(rewriteAddonImports("import {\n\tVector3\n} from 'three';\n")).toBe(
            "import {\n\tVector3\n} from './three.module.min.js';\n",
        );
    });

    it('3D viewer module build exposes the pinned REVISION', async () => {
        const three = await import(path.join(THREE_D_EXPORT, 'three.module.min.js'));
        expect(three.REVISION).toBe(revision);
        expect(typeof three.WebGLRenderer).toBe('function');
    });

    it('360 viewer classic build defines window.THREE with OrbitControls', () => {
        const context: { THREE?: Record<string, unknown> } = {};
        vm.createContext(context);
        vm.runInContext(fs.readFileSync(path.join(THREE_SIXTY_EXPORT, 'three.min.js'), 'utf-8'), context);
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
