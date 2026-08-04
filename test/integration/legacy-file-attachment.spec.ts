/**
 * Integration test: legacy File Attachment iDevice conversion.
 *
 * Builds a minimal legacy (.elp / contentv3.xml) package containing a single page
 * with one FileAttachIdeviceInc and two attached files (one with a description,
 * one without), runs it through the real ElpxImporter, and verifies the result is
 * a modern `file-attachment` iDevice whose attachments reference the imported
 * assets as `asset://` URLs.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as Y from 'yjs';
import { zipSync, strToU8 } from 'fflate';
import { ElpxImporter } from '../../src/shared/import/ElpxImporter';
import { FileSystemAssetHandler } from '../../src/shared/import/FileSystemAssetHandler';
import { createTempTestDir, cleanupTempTestDir } from '../helpers/fixture-loader';

const silentLogger = {
    log: () => {},
    warn: () => {},
    error: () => {},
};

/**
 * Minimal legacy contentv3.xml with one page and one FileAttachIdeviceInc.
 * `withSecondFile` controls whether the second (description-less) attachment is included.
 */
function buildLegacyXml(withSecondFile = true): string {
    const secondFile = withSecondFile
        ? `
            <instance class="exe.engine.field.FileField" reference="20">
             <dictionary>
              <string role="key" value="fileResource"></string>
              <instance class="exe.engine.resource.Resource" reference="21">
               <dictionary>
                <string role="key" value="_storageName"></string>
                <string value="notes.txt"></string>
               </dictionary>
              </instance>
             </dictionary>
            </instance>`
        : '';

    return `<?xml version="1.0" encoding="utf-8"?>
<instance xmlns="http://www.exelearning.org/content/v0.3" reference="1" version="0.3" class="exe.engine.package.Package">
 <dictionary>
  <string role="key" value="_title"></string>
  <unicode value="Legacy attachments package"></unicode>
  <string role="key" value="root"></string>
  <instance class="exe.engine.node.Node" reference="2">
   <dictionary>
    <string role="key" value="_title"></string>
    <unicode value="Home"></unicode>
    <string role="key" value="children"></string>
    <list></list>
    <string role="key" value="idevices"></string>
    <list>
     <instance class="exe.engine.fileattachidevice.FileAttachIdeviceInc" reference="10">
      <dictionary>
       <string role="key" value="_title"></string>
       <unicode value="Course files"></unicode>
       <string role="key" value="introHTML"></string>
       <instance class="exe.engine.field.TextAreaField" reference="11">
        <dictionary>
         <string role="key" value="content_w_resourcePaths"></string>
         <unicode value="&lt;p&gt;Download the materials below.&lt;/p&gt;"></unicode>
        </dictionary>
       </instance>
       <string role="key" value="showDesc"></string>
       <bool value="1"></bool>
       <string role="key" value="fileAttachmentFields"></string>
       <list>
        <instance class="exe.engine.field.FileField" reference="15">
         <dictionary>
          <string role="key" value="fileResource"></string>
          <instance class="exe.engine.resource.Resource" reference="16">
           <dictionary>
            <string role="key" value="_storageName"></string>
            <string value="worksheet.pdf"></string>
           </dictionary>
          </instance>
          <string role="key" value="fileDescription"></string>
          <instance class="exe.engine.field.TextField" reference="17">
           <dictionary>
            <string role="key" value="content"></string>
            <string value="Activity worksheet"></string>
           </dictionary>
          </instance>
         </dictionary>
        </instance>${secondFile}
       </list>
      </dictionary>
     </instance>
    </list>
   </dictionary>
  </instance>
 </dictionary>
</instance>`;
}

function buildLegacyElp(withSecondFile = true, withFiles = true): Uint8Array {
    const entries: Record<string, Uint8Array> = {
        'contentv3.xml': strToU8(buildLegacyXml(withSecondFile)),
    };
    if (withFiles) {
        entries['resources/worksheet.pdf'] = strToU8('%PDF-1.4 fake pdf body');
        if (withSecondFile) {
            entries['resources/notes.txt'] = strToU8('plain text notes');
        }
    }
    return zipSync(entries);
}

interface ComponentView {
    type: string;
    htmlView: string;
    props: {
        intro?: string;
        showDescriptions?: boolean;
        attachments?: Array<{ url: string; filename: string; title: string; description: string }>;
    };
}

function firstComponent(ydoc: Y.Doc): ComponentView {
    const navigation = ydoc.getArray('navigation');
    const page = navigation.get(0) as Y.Map<unknown>;
    const blocks = page.get('blocks') as Y.Array<unknown>;
    const block = blocks.get(0) as Y.Map<unknown>;
    const components = block.get('components') as Y.Array<unknown>;
    const component = components.get(0) as Y.Map<unknown>;
    const propsStr = component.get('jsonProperties') as string;
    return {
        type: component.get('type') as string,
        htmlView: (component.get('htmlView') as string) || '',
        props: propsStr ? JSON.parse(propsStr) : {},
    };
}

describe('Legacy File Attachment iDevice conversion', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = await createTempTestDir('legacy-file-attachment-');
    });

    afterEach(async () => {
        await cleanupTempTestDir(testDir);
    });

    it('converts a legacy FileAttachIdeviceInc into a file-attachment iDevice', async () => {
        const ydoc = new Y.Doc();
        const assetHandler = new FileSystemAssetHandler(testDir);
        const importer = new ElpxImporter(ydoc, assetHandler, silentLogger);

        const result = await importer.importFromBuffer(buildLegacyElp());
        expect(result.pages).toBeGreaterThan(0);
        expect(result.components).toBeGreaterThan(0);

        const component = firstComponent(ydoc);
        expect(component.type).toBe('file-attachment');

        ydoc.destroy();
    });

    it('preserves the intro and per-file description (mapped to the attachment title)', async () => {
        const ydoc = new Y.Doc();
        const assetHandler = new FileSystemAssetHandler(testDir);
        const importer = new ElpxImporter(ydoc, assetHandler, silentLogger);

        await importer.importFromBuffer(buildLegacyElp());
        const { props } = firstComponent(ydoc);

        expect(props.intro).toContain('Download the materials below.');
        expect(props.showDescriptions).toBe(true);

        const attachments = props.attachments || [];
        expect(attachments.length).toBe(2);
        expect(attachments[0].filename).toBe('worksheet.pdf');
        expect(attachments[0].title).toBe('Activity worksheet');
        // Second file has no legacy description -> empty title (iDevice falls back to filename).
        expect(attachments[1].filename).toBe('notes.txt');
        expect(attachments[1].title).toBe('');

        ydoc.destroy();
    });

    it('renders imported files before the iDevice is opened or saved', async () => {
        const ydoc = new Y.Doc();
        const assetHandler = new FileSystemAssetHandler(testDir);
        const importer = new ElpxImporter(ydoc, assetHandler, silentLogger);

        await importer.importFromBuffer(buildLegacyElp());
        const { htmlView } = firstComponent(ydoc);

        expect(htmlView).toContain('Download the materials below.');
        expect(htmlView.match(/class="fileAttachment-link"/g)).toHaveLength(2);
        expect(htmlView).toContain('Activity worksheet');
        expect(htmlView).toContain('notes.txt');
        expect(htmlView).toContain('href="asset://');
        expect(htmlView).not.toContain('href="resources/');

        ydoc.destroy();
    });

    it('rewrites attached-file references to asset:// URLs', async () => {
        const ydoc = new Y.Doc();
        const assetHandler = new FileSystemAssetHandler(testDir);
        const importer = new ElpxImporter(ydoc, assetHandler, silentLogger);

        await importer.importFromBuffer(buildLegacyElp());
        const { props } = firstComponent(ydoc);
        const attachments = props.attachments || [];

        for (const attachment of attachments) {
            expect(attachment.url.startsWith('asset://')).toBe(true);
            expect(attachment.url.startsWith('resources/')).toBe(false);
        }

        ydoc.destroy();
    });

    it('does not crash when the attached binary files are missing from the package', async () => {
        const ydoc = new Y.Doc();
        const assetHandler = new FileSystemAssetHandler(testDir);
        const importer = new ElpxImporter(ydoc, assetHandler, silentLogger);

        // Package references files that are not present in the ZIP.
        await importer.importFromBuffer(buildLegacyElp(true, false));
        const component = firstComponent(ydoc);

        expect(component.type).toBe('file-attachment');
        const attachments = component.props.attachments || [];
        expect(attachments.length).toBe(2);
        // Filenames/titles are still preserved even though the binaries are gone.
        expect(attachments[0].filename).toBe('worksheet.pdf');

        ydoc.destroy();
    });

    it('handles a single attachment with no description', async () => {
        const ydoc = new Y.Doc();
        const assetHandler = new FileSystemAssetHandler(testDir);
        const importer = new ElpxImporter(ydoc, assetHandler, silentLogger);

        await importer.importFromBuffer(buildLegacyElp(false));
        const { type, props } = firstComponent(ydoc);

        expect(type).toBe('file-attachment');
        expect((props.attachments || []).length).toBe(1);

        ydoc.destroy();
    });
});
