import { describe, expect, it } from 'bun:test';
import type { AssetProvider, ExportDocument, ExportMetadata, ExportPage, ResourceProvider } from '../interfaces';
import { FflateZipProvider } from '../providers/FflateZipProvider';
import { Scorm12MinimalExporter } from './Scorm12MinimalExporter';

class TestMinimalExporter extends Scorm12MinimalExporter {
    getFileSuffix(): string {
        return '_test';
    }

    exposeRenderOverrides() {
        return this.getScormPageRenderOverrides({} as ExportPage, [], this.getMetadata());
    }

    exposeThemeData() {
        return this.prepareThemeData('base');
    }

    exposeContentXml() {
        return this.getContentXml();
    }
}

function makeExporter(metadata: Partial<ExportMetadata> = {}): TestMinimalExporter {
    const document: ExportDocument = {
        getMetadata: () => ({
            title: 'Test',
            author: 'Author',
            language: 'en',
            theme: 'base',
            addExeLink: true,
            addPagination: true,
            addSearchBox: true,
            exportSource: true,
            ...metadata,
        }),
        getNavigation: () => [],
    };

    return new TestMinimalExporter(
        document,
        null as unknown as ResourceProvider,
        null as unknown as AssetProvider,
        new FflateZipProvider(),
    );
}

describe('Scorm12MinimalExporter', () => {
    it('forces metadata options for minimal packages', () => {
        const metadata = makeExporter().getMetadata();

        expect(metadata.addExeLink).toBe(false);
        expect(metadata.addPagination).toBe(false);
        expect(metadata.addSearchBox).toBe(false);
        expect(metadata.exportSource).toBe(false);
    });

    it('sets render overrides for a minimal SCORM page', () => {
        const overrides = makeExporter().exposeRenderOverrides();

        expect(overrides.minimalScorm).toBe(true);
        expect(overrides.addExeLink).toBe(false);
        expect(overrides.addPagination).toBe(false);
        expect(overrides.addSearchBox).toBe(false);
        expect(overrides.themeFiles).toEqual([]);
    });

    it('does not include theme files or content.xml', async () => {
        const exporter = makeExporter();
        const themeData = await exporter.exposeThemeData();
        const contentXml = await exporter.exposeContentXml();

        expect(themeData.themeRootFiles).toEqual([]);
        expect(themeData.themeFilesMap?.size).toBe(0);
        expect(themeData.faviconInfo).toBeNull();
        expect(contentXml).toBeNull();
    });
});
