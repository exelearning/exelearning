/**
 * Guards for pruned or trimmed vendored assets.
 *
 * mindmaps: the exemindmap TinyMCE plugin's editor iframe loads exactly
 * min/js/script.js plus four stylesheets under src/css (the src/js script
 * block in its index.html is an HTML comment pointing at a /tools/ path
 * that does not exist in any build). The dead development half was removed;
 * these tests pin the live set and keep the dead set from coming back.
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

describe('mindmaps vendored tree', () => {
    const mindmaps = path.join(commonDir, 'mindmaps');

    it('ships every file the exemindmap editor iframe references', () => {
        for (const file of [
            'min/js/script.js',
            'src/css/common.css',
            'src/css/app.css',
            'src/css/Aristo/jquery-ui-1.8.7.custom.css',
            'src/css/minicolors/jquery.miniColors.css',
            'LICENSE',
        ]) {
            expect(fs.existsSync(path.join(mindmaps, file)), `missing ${file}`).toBe(true);
        }
    });

    it('does not ship the commented-out development sources', () => {
        for (const gone of ['src/js', 'src/index.html', 'src/about.html', 'src/cache.appcache', 'src/css/about.css']) {
            expect(fs.existsSync(path.join(mindmaps, gone)), `${gone} should stay removed`).toBe(false);
        }
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
