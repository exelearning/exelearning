/**
 * Guards for pruned or trimmed vendored assets.
 *
 * mindmaps: the legacy mind map editor (mindmaps.app and the exemindmap
 * plugin's editor iframe with its private jQuery, Cropper and FileSaver
 * copies) was retired; the exemindmap plugin only converts existing maps to
 * Mermaid. Every distribution copies these trees, so they must stay gone.
 *
 * exe_media: the MediaElement 2.x Flash/Silverlight fallback binaries can
 * never load in any shipping browser (plugin APIs removed in 2015-2021)
 * and were excluded from exports already; only inert config-string
 * defaults remain in exe_media.js.
 *
 * bootstrap (public/libs): this PR stops shipping the two Bootstrap source
 * maps, so the dist files must no longer announce them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const commonDir = path.dirname(fileURLToPath(import.meta.url));

describe('retired mindmaps editor', () => {
    it('does not ship the mindmaps application or the exemindmap editor iframe', () => {
        const pluginDir = path.resolve(commonDir, '../../libs/tinymce_5/js/tinymce/plugins/exemindmap');
        expect(fs.existsSync(path.join(commonDir, 'mindmaps'))).toBe(false);
        expect(fs.existsSync(path.join(pluginDir, 'editor'))).toBe(false);
        expect(fs.readdirSync(pluginDir).sort()).toEqual(['css', 'exemindmap-plugin.test.js', 'plugin.min.js']);
    });
});

describe('exe_media legacy plugin binaries', () => {
    it('does not ship Flash/Silverlight fallback payloads', () => {
        expect(fs.existsSync(path.join(commonDir, 'exe_media/exe_media_flashPlayer.swf'))).toBe(false);
        expect(fs.existsSync(path.join(commonDir, 'exe_media/exe_media_silverlightPlayer.xap'))).toBe(false);
    });

    it('still ships the player scripts the Text iDevice and TinyMCE plugins load', () => {
        expect(fs.existsSync(path.join(commonDir, 'exe_media/exe_media.js'))).toBe(true);
    });
});

describe('vendored Bootstrap dist files', () => {
    // Dropping the .map files from BASE_LIBRARIES and from the resource bundle
    // is only half the change: a `//# sourceMappingURL=` left behind turns every
    // exported package into a 404 the moment someone opens DevTools. The
    // announcement is stripped from the vendored files themselves, so all four
    // consumers (exports, resource bundles, the static dist and server mode)
    // agree without any runtime transform. A Bootstrap upgrade that drops in
    // fresh dist files brings the comment back — this is what catches it.
    const libsDir = path.join(commonDir, '../../libs');

    it('does not announce a source map the project no longer ships', () => {
        for (const file of ['bootstrap/bootstrap.bundle.min.js', 'bootstrap/bootstrap.min.css']) {
            const content = fs.readFileSync(path.join(libsDir, file), 'utf-8');
            expect(content.includes('sourceMappingURL'), `${file} still announces a source map`).toBe(false);
        }
    });
});
