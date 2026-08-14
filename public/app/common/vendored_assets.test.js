/**
 * Guards for pruned vendored asset trees under public/app/common.
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
