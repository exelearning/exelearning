/**
 * Integration: stable identifiers end-to-end (#1782, #1783, #1784, #1785, #1786).
 *
 * Exercises the chain the unit tests cannot cover in isolation:
 *   v4 .elpx (with <odeResources>)
 *     → ElpxImporter → Y.Doc metadata + navigation
 *     → YjsDocumentAdapter → ExportMetadata
 *
 * Once `ExportMetadata.odeIdentifier` is set, the per-exporter unit tests
 * (Scorm12 / Scorm2004 / IMS spec files) already prove that the manifest,
 * organization and LOM/content.xml roots are derived consistently from it
 * (see #1785). This test pins the bridge from XML through Yjs to that
 * boundary so a regression in import or adapter cannot silently disable
 * stable LMS tracking.
 */
import { describe, it, expect } from 'bun:test';
import * as Y from 'yjs';
import { zipSync } from 'fflate';
import { ElpxImporter } from '../../src/shared/import/ElpxImporter';
import { YjsDocumentAdapter } from '../../src/shared/export/adapters/YjsDocumentAdapter';

const silentLogger = {
    log: () => {},
    warn: () => {},
    error: () => {},
};

const ODE_ID = '20251201123456ABCDEF';
const ODE_VERSION_ID = '20251201123456FEDCBA';

const buildContentXml = (): string => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources>
  <odeResource><key>odeId</key><value>${ODE_ID}</value></odeResource>
  <odeResource><key>odeVersionId</key><value>${ODE_VERSION_ID}</value></odeResource>
  <odeResource><key>exe_version</key><value>4.0.0</value></odeResource>
</odeResources>
<odeProperties>
  <odeProperty><key>pp_title</key><value>Integration Stable Identifiers</value></odeProperty>
  <odeProperty><key>pp_lang</key><value>en</value></odeProperty>
</odeProperties>
<odeNavStructures>
<odeNavStructure>
  <odePageId>page-mp0fppwf-71v64kl4r</odePageId>
  <pageName>Introduction</pageName>
  <odeNavStructureOrder>0</odeNavStructureOrder>
  <odePagStructures>
    <odePagStructure>
      <odeBlockId>block-mp0fppwf-aaaaaaaaa</odeBlockId>
      <blockName>Text</blockName>
      <odeBlockOrder>0</odeBlockOrder>
      <odeComponents>
        <odeComponent>
          <odeIdeviceId>idevice-mp0fppwf-bbbbbbbbb</odeIdeviceId>
          <odeIdeviceTypeName>text</odeIdeviceTypeName>
          <htmlView>&lt;p&gt;Hello LMS&lt;/p&gt;</htmlView>
          <odeComponentOrder>0</odeComponentOrder>
        </odeComponent>
      </odeComponents>
    </odePagStructure>
  </odePagStructures>
</odeNavStructure>
</odeNavStructures>
</ode>`;

async function importV4ContentIntoYDoc(contentXml: string): Promise<Y.Doc> {
    const ydoc = new Y.Doc();
    const importer = new ElpxImporter(ydoc, null, silentLogger);
    const zip = zipSync({ 'content.xml': new TextEncoder().encode(contentXml) });
    await importer.importFromBuffer(zip, { clearExisting: true });
    return ydoc;
}

function makeYjsManagerFromDoc(ydoc: Y.Doc) {
    return {
        getDoc: () => ydoc,
        getMetadata: () => ydoc.getMap('metadata'),
        getNavigation: () => ydoc.getArray('navigation'),
        projectId: 'stable-id-integration-test',
    };
}

describe('stable identifiers end-to-end (#1786)', () => {
    it('preserves odeId/odeVersionId from content.xml all the way into Y.Doc metadata', async () => {
        const ydoc = await importV4ContentIntoYDoc(buildContentXml());
        const meta = ydoc.getMap('metadata');
        expect(meta.get('odeIdentifier')).toBe(ODE_ID);
        expect(meta.get('odeVersionId')).toBe(ODE_VERSION_ID);
        ydoc.destroy();
    });

    it('preserves page/block/iDevice ids verbatim through Yjs navigation', async () => {
        const ydoc = await importV4ContentIntoYDoc(buildContentXml());
        const nav = ydoc.getArray('navigation');
        expect(nav.length).toBe(1);
        const page = nav.get(0) as Y.Map<unknown>;
        expect(page.get('id')).toBe('page-mp0fppwf-71v64kl4r');
        const block = (page.get('blocks') as Y.Array<unknown>).get(0) as Y.Map<unknown>;
        expect(block.get('id')).toBe('block-mp0fppwf-aaaaaaaaa');
        const component = (block.get('components') as Y.Array<unknown>).get(0) as Y.Map<unknown>;
        expect(component.get('id')).toBe('idevice-mp0fppwf-bbbbbbbbb');
        ydoc.destroy();
    });

    it('YjsDocumentAdapter forwards stable identifiers to ExportMetadata (#1784 review)', async () => {
        const ydoc = await importV4ContentIntoYDoc(buildContentXml());
        const adapter = new YjsDocumentAdapter(
            makeYjsManagerFromDoc(ydoc) as unknown as ConstructorParameters<typeof YjsDocumentAdapter>[0],
        );
        const exportMeta = adapter.getMetadata();
        // The fields the SCORM/IMS exporter unit tests then consume via
        // BaseExporter.getManifestIdentifier() -- see #1785 specs.
        expect(exportMeta.odeIdentifier).toBe(ODE_ID);
        expect(exportMeta.odeVersionId).toBe(ODE_VERSION_ID);
        ydoc.destroy();
    });

    it('survives a full XML round-trip: import -> generateOdeXml -> re-import keeps every identifier (#1786)', async () => {
        // The strongest invariant: take an imported project, re-emit content.xml
        // through the real export-side generator, then re-import that emitted
        // XML into a fresh Y.Doc. All identifiers (project + page/block/idevice)
        // must survive both legs untouched.
        const { generateOdeXml } = await import('../../src/shared/export/generators/OdeXmlGenerator');

        const ydocA = await importV4ContentIntoYDoc(buildContentXml());
        const adapterA = new YjsDocumentAdapter(
            makeYjsManagerFromDoc(ydocA) as unknown as ConstructorParameters<typeof YjsDocumentAdapter>[0],
        );
        const metaA = adapterA.getMetadata();
        const pagesA = adapterA.getNavigation();

        const exportedXml = generateOdeXml(metaA, pagesA);

        // Re-import the just-emitted XML and read everything back.
        const ydocB = await importV4ContentIntoYDoc(exportedXml);
        const metaB = ydocB.getMap('metadata');
        expect(metaB.get('odeIdentifier')).toBe(ODE_ID);
        expect(metaB.get('odeVersionId')).toBe(ODE_VERSION_ID);

        const navB = ydocB.getArray('navigation');
        expect(navB.length).toBe(1);
        const pageB = navB.get(0) as Y.Map<unknown>;
        expect(pageB.get('id')).toBe('page-mp0fppwf-71v64kl4r');
        const blockB = (pageB.get('blocks') as Y.Array<unknown>).get(0) as Y.Map<unknown>;
        expect(blockB.get('id')).toBe('block-mp0fppwf-aaaaaaaaa');
        const compB = (blockB.get('components') as Y.Array<unknown>).get(0) as Y.Map<unknown>;
        expect(compB.get('id')).toBe('idevice-mp0fppwf-bbbbbbbbb');

        ydocA.destroy();
        ydocB.destroy();
    });

    it('two consecutive imports of the same XML keep identifiers stable across the chain', async () => {
        const xml = buildContentXml();
        const ydocA = await importV4ContentIntoYDoc(xml);
        const ydocB = await importV4ContentIntoYDoc(xml);
        const metaA = new YjsDocumentAdapter(
            makeYjsManagerFromDoc(ydocA) as unknown as ConstructorParameters<typeof YjsDocumentAdapter>[0],
        ).getMetadata();
        const metaB = new YjsDocumentAdapter(
            makeYjsManagerFromDoc(ydocB) as unknown as ConstructorParameters<typeof YjsDocumentAdapter>[0],
        ).getMetadata();
        // odeId / odeVersionId stay identical -- no LMS-tracking break on re-upload.
        expect(metaA.odeIdentifier).toBe(metaB.odeIdentifier);
        expect(metaA.odeVersionId).toBe(metaB.odeVersionId);
        ydocA.destroy();
        ydocB.destroy();
    });
});
